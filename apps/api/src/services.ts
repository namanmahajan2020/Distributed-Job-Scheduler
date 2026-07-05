import {
  JobStatus,
  JobType,
  OrganizationRole,
  Prisma,
  QueueStatus,
  RetryStrategy,
  WorkerStatus
} from "@prisma/client";
import crypto from "crypto";
import cron from "node-cron";
import { StatusCodes } from "http-status-codes";
import {
  CreateBatchJobInput,
  CreateJobInput,
  CreateOrganizationInput,
  CreateProjectInput,
  CreateQueueInput,
  CreateRecurringJobInput
} from "@scheduler/shared";
import { prisma } from "./lib/prisma";
import { ApiError } from "./lib/errors";
import {
  comparePassword,
  hashPassword,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from "./lib/auth";
import { logger } from "./lib/logger";
import { realtime } from "./realtime";

type ListInput = {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder: "asc" | "desc";
};

type PaginatedResult<T> = {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const createPaginationResult = <T>(items: T[], total: number, page: number, limit: number): PaginatedResult<T> => ({
  items,
  meta: {
    page,
    limit,
    total,
    totalPages: Math.max(Math.ceil(total / limit), 1)
  }
});

const computeNextRetryAt = (attempt: number, strategy: RetryStrategy, baseDelayMs: number, maxDelayMs: number) => {
  const multiplier = strategy === "FIXED" ? 1 : strategy === "LINEAR" ? attempt : Math.pow(2, attempt - 1);
  return new Date(Date.now() + Math.min(baseDelayMs * multiplier, maxDelayMs));
};

const sanitizeUser = <T extends { passwordHash: string; [key: string]: unknown }>(user: T) => {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
};

const safeOrderBy = <T extends string>(sortBy: string | undefined, allowed: T[], fallback: T, sortOrder: "asc" | "desc") =>
  allowed.includes(sortBy as T) ? { [sortBy as T]: sortOrder } : { [fallback]: sortOrder };

const createJobLog = async (jobId: string, level: string, message: string, metadata?: Prisma.InputJsonValue, actorUserId?: string) => {
  const log = await prisma.jobLog.create({
    data: { jobId, level, message, metadata, actorUserId }
  });
  realtime.emitLogUpdate(log);
  return log;
};

const createSessionTokens = async (userId: string, email: string, ipAddress?: string, userAgent?: string) => {
  const session = await prisma.session.create({
    data: {
      userId,
      ipAddress,
      userAgent,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
    }
  });

  const refreshTokenId = crypto.randomUUID();
  const refreshToken = signRefreshToken({ sub: userId, email, sessionId: session.id, tokenId: refreshTokenId });
  const accessToken = signAccessToken({ sub: userId, email, sessionId: session.id });

  await prisma.refreshToken.create({
    data: {
      id: refreshTokenId,
      userId,
      sessionId: session.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
    }
  });

  return { session, accessToken, refreshToken };
};

const resolveScheduledFor = (input: Pick<CreateJobInput, "type" | "scheduledFor" | "delaySeconds">) => {
  if (input.scheduledFor) {
    return new Date(input.scheduledFor);
  }
  if (input.type === "DELAYED" && input.delaySeconds) {
    return new Date(Date.now() + input.delaySeconds * 1000);
  }
  return null;
};

export const authService = {
  register: async (input: { email: string; password: string; name: string }) => {
    const existingUser = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingUser) {
      throw new ApiError(StatusCodes.CONFLICT, "Email already registered");
    }

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.user.create({
      data: { email: input.email, passwordHash, name: input.name }
    });

    return sanitizeUser(user);
  },
  login: async (input: { email: string; password: string; ipAddress?: string; userAgent?: string }) => {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: {
        memberships: true
      }
    });

    if (!user || !(await comparePassword(input.password, user.passwordHash))) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid credentials");
    }

    const { accessToken, refreshToken } = await createSessionTokens(user.id, user.email, input.ipAddress, input.userAgent);

    return { user: sanitizeUser(user), accessToken, refreshToken };
  },
  refresh: async (refreshToken: string) => {
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true, session: true }
    });

    if (!stored || stored.id !== payload.tokenId || stored.revokedAt || stored.expiresAt < new Date() || stored.session.revokedAt) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Refresh token expired");
    }

    const nextTokenId = crypto.randomUUID();
    const nextRefreshToken = signRefreshToken({
      sub: stored.userId,
      email: stored.user.email,
      sessionId: stored.sessionId,
      tokenId: nextTokenId
    });
    const accessToken = signAccessToken({
      sub: stored.userId,
      email: stored.user.email,
      sessionId: stored.sessionId
    });

    await prisma.$transaction([
      prisma.refreshToken.update({
        where: { id: stored.id },
        data: {
          revokedAt: new Date(),
          replacedByTokenHash: hashToken(nextRefreshToken)
        }
      }),
      prisma.refreshToken.create({
        data: {
          id: nextTokenId,
          userId: stored.userId,
          sessionId: stored.sessionId,
          tokenHash: hashToken(nextRefreshToken),
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
        }
      })
    ]);

    return { accessToken, refreshToken: nextRefreshToken };
  },
  logout: async (refreshToken: string) => {
    const payload = verifyRefreshToken(refreshToken);
    await prisma.$transaction([
      prisma.refreshToken.updateMany({
        where: { sessionId: payload.sessionId, revokedAt: null },
        data: { revokedAt: new Date() }
      }),
      prisma.session.update({
        where: { id: payload.sessionId },
        data: { revokedAt: new Date() }
      })
    ]);
  },
  me: async (userId: string) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            organization: true
          }
        }
      }
    });
    return sanitizeUser(user);
  }
};

export const orgService = {
  createOrganization: async (userId: string, input: CreateOrganizationInput) => {
    const organization = await prisma.organization.create({
      data: {
        ...input,
        members: {
          create: {
            userId,
            role: OrganizationRole.ADMIN
          }
        }
      },
      include: { members: true }
    });
    return organization;
  },
  listOrganizations: async (userId: string, input: ListInput) => {
    const where: Prisma.OrganizationWhereInput = {
      deletedAt: null,
      members: {
        some: {
          userId
        }
      },
      OR: input.search ? [
        { name: { contains: input.search, mode: "insensitive" } },
        { slug: { contains: input.search, mode: "insensitive" } }
      ] : undefined
    };

    const [items, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        include: {
          members: true,
          projects: {
            where: { deletedAt: null }
          }
        },
        orderBy: safeOrderBy(input.sortBy, ["createdAt", "name"], "createdAt", input.sortOrder),
        skip: (input.page - 1) * input.limit,
        take: input.limit
      }),
      prisma.organization.count({ where })
    ]);

    return createPaginationResult(items, total, input.page, input.limit);
  },
  inviteMember: async (organizationId: string, email: string, role: OrganizationRole) =>
    prisma.organizationInvite.create({
      data: {
        organizationId,
        email,
        role,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
      }
    })
};

export const projectService = {
  createProject: async (input: CreateProjectInput) => prisma.project.create({ data: input }),
  listProjects: async (input: ListInput & { organizationId?: string; userId?: string }) => {
    const where: Prisma.ProjectWhereInput = {
      deletedAt: null,
      organizationId: input.organizationId,
      organization: input.userId ? {
        members: {
          some: { userId: input.userId }
        }
      } : undefined,
      OR: input.search ? [
        { name: { contains: input.search, mode: "insensitive" } },
        { slug: { contains: input.search, mode: "insensitive" } },
        { description: { contains: input.search, mode: "insensitive" } }
      ] : undefined
    };

    const [items, total] = await Promise.all([
      prisma.project.findMany({
        where,
        include: { queues: { where: { deletedAt: null }, include: { retryPolicy: true } } },
        orderBy: safeOrderBy(input.sortBy, ["createdAt", "name", "updatedAt"], "createdAt", input.sortOrder),
        skip: (input.page - 1) * input.limit,
        take: input.limit
      }),
      prisma.project.count({ where })
    ]);

    return createPaginationResult(items, total, input.page, input.limit);
  },
  updateProject: async (projectId: string, data: Partial<CreateProjectInput>) =>
    prisma.project.update({ where: { id: projectId }, data }),
  deleteProject: async (projectId: string) =>
    prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } })
};

export const queueService = {
  createQueue: async (input: CreateQueueInput) => {
    const queue = await prisma.queue.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        concurrencyLimit: input.concurrencyLimit,
        maxWorkers: input.maxWorkers,
        rateLimitPerMin: input.rateLimitPerMin,
        priorityEnabled: input.priorityEnabled,
        retryPolicy: {
          create: input.retryPolicy
        }
      },
      include: { retryPolicy: true, project: true }
    });
    realtime.emitQueueUpdate(queue);
    return queue;
  },
  listQueues: async (input: ListInput & { projectId?: string; organizationId?: string; status?: QueueStatus }) => {
    const where: Prisma.QueueWhereInput = {
      deletedAt: null,
      projectId: input.projectId,
      status: input.status,
      project: input.organizationId ? { organizationId: input.organizationId } : undefined,
      OR: input.search ? [
        { name: { contains: input.search, mode: "insensitive" } },
        { slug: { contains: input.search, mode: "insensitive" } },
        { description: { contains: input.search, mode: "insensitive" } }
      ] : undefined
    };

    const [items, total] = await Promise.all([
      prisma.queue.findMany({
        where,
        include: {
          retryPolicy: true,
          project: true,
          _count: { select: { jobs: true, scheduledJobs: true } }
        },
        orderBy: safeOrderBy(input.sortBy, ["createdAt", "name", "updatedAt"], "createdAt", input.sortOrder),
        skip: (input.page - 1) * input.limit,
        take: input.limit
      }),
      prisma.queue.count({ where })
    ]);

    return createPaginationResult(items, total, input.page, input.limit);
  },
  updateQueue: async (queueId: string, data: Partial<CreateQueueInput>) => {
    const queue = await prisma.queue.update({
      where: { id: queueId },
      data: {
        name: data.name,
        description: data.description,
        concurrencyLimit: data.concurrencyLimit,
        maxWorkers: data.maxWorkers,
        rateLimitPerMin: data.rateLimitPerMin,
        priorityEnabled: data.priorityEnabled,
        retryPolicy: data.retryPolicy ? {
          upsert: {
            create: data.retryPolicy,
            update: data.retryPolicy
          }
        } : undefined
      },
      include: { retryPolicy: true }
    });
    realtime.emitQueueUpdate(queue);
    return queue;
  },
  pauseQueue: async (queueId: string) => {
    const queue = await prisma.queue.update({ where: { id: queueId }, data: { status: QueueStatus.PAUSED, pausedAt: new Date() } });
    realtime.emitQueueUpdate(queue);
    return queue;
  },
  resumeQueue: async (queueId: string) => {
    const queue = await prisma.queue.update({ where: { id: queueId }, data: { status: QueueStatus.ACTIVE, pausedAt: null } });
    realtime.emitQueueUpdate(queue);
    return queue;
  },
  deleteQueue: async (queueId: string) => {
    const queue = await prisma.queue.update({ where: { id: queueId }, data: { deletedAt: new Date(), status: QueueStatus.ARCHIVED } });
    realtime.emitQueueUpdate(queue);
    return queue;
  },
  getQueueStats: async (queueId: string) => {
    const [queue, grouped, activeWorkers, throughput, recentFailures] = await Promise.all([
      prisma.queue.findUniqueOrThrow({ where: { id: queueId }, include: { retryPolicy: true, project: true } }),
      prisma.job.groupBy({
        by: ["status"],
        where: { queueId },
        _count: { _all: true }
      }),
      prisma.worker.count({
        where: {
          lastHeartbeat: { gte: new Date(Date.now() - 15000) }
        }
      }),
      prisma.$queryRaw<Array<{ minute_bucket: Date; completed: bigint; failed: bigint }>>`
        SELECT date_trunc('minute', "createdAt") AS minute_bucket,
               COUNT(*) FILTER (WHERE status = 'COMPLETED')::bigint AS completed,
               COUNT(*) FILTER (WHERE status = 'FAILED')::bigint AS failed
        FROM "JobExecution"
        WHERE "createdAt" >= NOW() - interval '60 minutes'
          AND "jobId" IN (SELECT id FROM "Job" WHERE "queueId" = ${queueId})
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.job.findMany({
        where: { queueId, status: { in: [JobStatus.FAILED, JobStatus.DEAD_LETTER] } },
        take: 5,
        orderBy: { updatedAt: "desc" },
        select: { id: true, name: true, errorMessage: true, updatedAt: true, status: true }
      })
    ]);

    return {
      queue,
      counts: grouped,
      activeWorkers,
      throughput: throughput.map((row) => ({
        bucket: row.minute_bucket,
        completed: Number(row.completed),
        failed: Number(row.failed)
      })),
      recentFailures
    };
  }
};

const buildJobListWhere = (filters: {
  queueId?: string;
  projectId?: string;
  status?: JobStatus;
  type?: JobType;
  batchKey?: string;
  search?: string;
}): Prisma.JobWhereInput => ({
  queueId: filters.queueId,
  status: filters.status,
  type: filters.type,
  batchKey: filters.batchKey,
  queue: filters.projectId ? { projectId: filters.projectId } : undefined,
  OR: filters.search ? [
    { name: { contains: filters.search, mode: "insensitive" } },
    { batchKey: { contains: filters.search, mode: "insensitive" } },
    { deduplicationKey: { contains: filters.search, mode: "insensitive" } }
  ] : undefined
});

export const jobService = {
  createJob: async (input: CreateJobInput) => {
    const queue = await prisma.queue.findUnique({
      where: { id: input.queueId },
      include: { retryPolicy: true }
    });

    if (!queue || queue.status !== QueueStatus.ACTIVE) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Queue is not active");
    }

    const scheduledFor = resolveScheduledFor(input);
    const resolvedStatus = scheduledFor ? JobStatus.SCHEDULED : JobStatus.QUEUED;

    const job = await prisma.job.create({
      data: {
        queueId: input.queueId,
        name: input.name,
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
        priority: input.priority,
        scheduledFor,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        batchKey: input.batchKey,
        deduplicationKey: input.deduplicationKey,
        maxRetries: input.maxRetries,
        timeoutMs: input.timeoutMs,
        status: resolvedStatus
      }
    });

    await createJobLog(job.id, "info", "Job created", {
      type: input.type,
      scheduledFor,
      priority: input.priority
    });

    realtime.emitJobUpdate(job);
    return job;
  },
  createBatchJobs: async (input: CreateBatchJobInput) => {
    const batchKey = `batch_${crypto.randomUUID()}`;
    const scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : null;
    const status = scheduledFor ? JobStatus.SCHEDULED : JobStatus.QUEUED;

    const createdJobs = await prisma.$transaction(input.items.map((payload, index) =>
      prisma.job.create({
        data: {
          queueId: input.queueId,
          name: `${input.name} #${index + 1}`,
          type: JobType.BATCH,
          payload: payload as Prisma.InputJsonValue,
          priority: input.priority,
          scheduledFor,
          batchKey,
          batchSize: input.items.length,
          batchIndex: index,
          maxRetries: input.maxRetries,
          timeoutMs: input.timeoutMs,
          status
        }
      })
    ));

    await Promise.all(createdJobs.map((job) => createJobLog(job.id, "info", "Batch job created", {
      batchKey,
      batchIndex: job.batchIndex,
      batchSize: job.batchSize
    })));

    realtime.emitJobUpdate({ batchKey, count: createdJobs.length, status });
    return { batchKey, count: createdJobs.length, jobs: createdJobs };
  },
  listJobs: async (filters: ListInput & {
    queueId?: string;
    projectId?: string;
    status?: JobStatus;
    type?: JobType;
    batchKey?: string;
  }) => {
    const where = buildJobListWhere(filters);

    const [items, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          executions: { orderBy: { attempt: "desc" } },
          deadLetterEntry: true,
          queue: { include: { project: true } },
          currentWorker: true
        },
        orderBy: [
          safeOrderBy(filters.sortBy, ["createdAt", "updatedAt", "priority", "scheduledFor"], "createdAt", filters.sortOrder),
          { priority: "desc" }
        ],
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit
      }),
      prisma.job.count({ where })
    ]);

    return createPaginationResult(items, total, filters.page, filters.limit);
  },
  listJobLogs: async (jobId: string, input: ListInput) => {
    const where: Prisma.JobLogWhereInput = { jobId };
    const [items, total] = await Promise.all([
      prisma.jobLog.findMany({
        where,
        orderBy: { createdAt: input.sortOrder },
        skip: (input.page - 1) * input.limit,
        take: input.limit
      }),
      prisma.jobLog.count({ where })
    ]);

    return createPaginationResult(items, total, input.page, input.limit);
  },
  retryFromDlq: async (jobId: string, actorUserId?: string) =>
    prisma.$transaction(async (tx) => {
      const job = await tx.job.findUnique({ where: { id: jobId } });
      if (!job || job.status !== JobStatus.DEAD_LETTER) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Job is not in dead letter queue");
      }

      await tx.deadLetterQueueEntry.delete({ where: { jobId } });
      const updated = await tx.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.QUEUED,
          retryCount: 0,
          errorMessage: null,
          scheduledFor: new Date(),
          currentWorkerId: null,
          claimedAt: null,
          startedAt: null
        }
      });
      await createJobLog(jobId, "info", "Job retried from DLQ", undefined, actorUserId);
      realtime.emitJobUpdate(updated);
      return updated;
    }),
  cancelJob: async (jobId: string, actorUserId?: string) => {
    const job = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.CANCELLED,
        cancelledAt: new Date(),
        currentWorkerId: null
      }
    });
    await createJobLog(jobId, "info", "Job cancelled", undefined, actorUserId);
    realtime.emitJobUpdate(job);
    return job;
  },
  promoteScheduledJobs: async () => {
    const result = await prisma.job.updateMany({
      where: {
        status: { in: [JobStatus.SCHEDULED, JobStatus.RETRYING] },
        scheduledFor: { lte: new Date() }
      },
      data: {
        status: JobStatus.QUEUED
      }
    });
    if (result.count > 0) {
      realtime.emitJobUpdate({ promoted: result.count });
    }
    return result;
  },
  failJobAndScheduleRetry: async (jobId: string, errorMessage: string) =>
    prisma.$transaction(async (tx) => {
      const job = await tx.job.findUniqueOrThrow({
        where: { id: jobId },
        include: { queue: { include: { retryPolicy: true } } }
      });
      const retryPolicy = job.queue.retryPolicy;
      const retryCount = job.retryCount + 1;

      if (!retryPolicy || retryCount > job.maxRetries || retryCount > retryPolicy.maxRetries) {
        await tx.deadLetterQueueEntry.upsert({
          where: { jobId: job.id },
          create: { jobId: job.id, reason: errorMessage },
          update: { reason: errorMessage, movedAt: new Date() }
        });
        const updated = await tx.job.update({
          where: { id: job.id },
          data: { status: JobStatus.DEAD_LETTER, errorMessage, retryCount, lastErrorAt: new Date(), currentWorkerId: null }
        });
        realtime.emitJobUpdate(updated);
        return updated;
      }

      const nextAttemptAt = computeNextRetryAt(retryCount, retryPolicy.strategy, retryPolicy.baseDelayMs, retryPolicy.maxDelayMs);
      const updated = await tx.job.update({
        where: { id: job.id },
        data: {
          status: JobStatus.RETRYING,
          retryCount,
          errorMessage,
          lastErrorAt: new Date(),
          scheduledFor: nextAttemptAt,
          currentWorkerId: null
        }
      });
      realtime.emitJobUpdate(updated);
      return updated;
    }),
  recoverStaleJobs: async () => {
    const staleJobs = await prisma.job.findMany({
      where: {
        status: { in: [JobStatus.CLAIMED, JobStatus.RUNNING] },
        claimedAt: { lte: new Date(Date.now() - 1000 * 60 * 10) }
      },
      select: { id: true }
    });

    const result = await prisma.job.updateMany({
      where: {
        id: { in: staleJobs.map((job) => job.id) }
      },
      data: {
        status: JobStatus.QUEUED,
        claimedAt: null,
        startedAt: null,
        currentWorkerId: null
      }
    });

    if (result.count > 0) {
      realtime.emitJobUpdate({ recovered: result.count });
    }
    return result;
  }
};

export const recurringJobService = {
  createRecurringJob: async (input: CreateRecurringJobInput) => {
    if (!cron.validate(input.cronExpression)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid cron expression");
    }

    const job = await prisma.scheduledJob.create({
      data: {
        queueId: input.queueId,
        name: input.name,
        cronExpression: input.cronExpression,
        payload: input.payload as Prisma.InputJsonValue,
        timezone: input.timezone,
        priority: input.priority,
        maxRetries: input.maxRetries,
        timeoutMs: input.timeoutMs,
        deduplicationKey: input.deduplicationKey
      }
    });
    realtime.emitJobUpdate({ scheduledJob: job });
    return job;
  },
  updateRecurringJob: async (scheduledJobId: string, input: Partial<CreateRecurringJobInput>) => {
    if (input.cronExpression && !cron.validate(input.cronExpression)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid cron expression");
    }

    const job = await prisma.scheduledJob.update({
      where: { id: scheduledJobId },
      data: {
        name: input.name,
        cronExpression: input.cronExpression,
        payload: input.payload as Prisma.InputJsonValue | undefined,
        timezone: input.timezone,
        priority: input.priority,
        maxRetries: input.maxRetries,
        timeoutMs: input.timeoutMs,
        deduplicationKey: input.deduplicationKey
      }
    });
    realtime.emitJobUpdate({ scheduledJob: job });
    return job;
  },
  deactivateRecurringJob: async (scheduledJobId: string) => {
    const job = await prisma.scheduledJob.update({
      where: { id: scheduledJobId },
      data: { active: false }
    });
    realtime.emitJobUpdate({ scheduledJob: job });
    return job;
  },
  listRecurringJobs: async (input: ListInput & { queueId?: string }) => {
    const where: Prisma.ScheduledJobWhereInput = {
      queueId: input.queueId,
      OR: input.search ? [
        { name: { contains: input.search, mode: "insensitive" } },
        { cronExpression: { contains: input.search, mode: "insensitive" } }
      ] : undefined
    };

    const [items, total] = await Promise.all([
      prisma.scheduledJob.findMany({
        where,
        include: { queue: true },
        orderBy: safeOrderBy(input.sortBy, ["createdAt", "updatedAt", "name"], "createdAt", input.sortOrder),
        skip: (input.page - 1) * input.limit,
        take: input.limit
      }),
      prisma.scheduledJob.count({ where })
    ]);

    return createPaginationResult(items, total, input.page, input.limit);
  },
  triggerDueRecurringJobs: async () => {
    const candidates = await prisma.scheduledJob.findMany({
      where: { active: true },
      include: { queue: true }
    });

    let created = 0;
    for (const candidate of candidates) {
      const shouldRun = cron.validate(candidate.cronExpression);
      const alreadyRanThisMinute = candidate.lastRunAt && Math.abs(Date.now() - candidate.lastRunAt.getTime()) < 60_000;
      if (!shouldRun || alreadyRanThisMinute || candidate.queue.status !== QueueStatus.ACTIVE) {
        continue;
      }

      const job = await prisma.job.create({
        data: {
          queueId: candidate.queueId,
          scheduledJobId: candidate.id,
          type: JobType.RECURRING,
          status: JobStatus.QUEUED,
          name: candidate.name,
          payload: candidate.payload as Prisma.InputJsonValue,
          priority: candidate.priority,
          maxRetries: candidate.maxRetries,
          timeoutMs: candidate.timeoutMs,
          deduplicationKey: candidate.deduplicationKey ? `${candidate.deduplicationKey}:${new Date().toISOString().slice(0, 16)}` : null
        }
      });

      await prisma.scheduledJob.update({
        where: { id: candidate.id },
        data: { lastRunAt: new Date() }
      });
      await createJobLog(job.id, "info", "Recurring job enqueued", { scheduledJobId: candidate.id });
      realtime.emitJobUpdate(job);
      created += 1;
    }

    return { created };
  }
};

export const workerService = {
  registerWorker: async (name: string, concurrency: number) =>
    prisma.worker.upsert({
      where: { name },
      create: { name, concurrency, status: WorkerStatus.IDLE, lastHeartbeat: new Date() },
      update: { concurrency, status: WorkerStatus.IDLE, lastHeartbeat: new Date(), shutdownRequestedAt: null }
    }),
  heartbeat: async (workerId: string, activeJobs: number, cpuUsage?: number, memoryMb?: number) => {
    const worker = await prisma.worker.update({
      where: { id: workerId },
      data: {
        status: activeJobs > 0 ? WorkerStatus.ACTIVE : WorkerStatus.IDLE,
        lastHeartbeat: new Date(),
        heartbeats: {
          create: { activeJobs, cpuUsage, memoryMb }
        }
      }
    });
    realtime.emitWorkerUpdate(worker);
    return worker;
  },
  listWorkers: async (input: ListInput & { status?: WorkerStatus }) => {
    const where: Prisma.WorkerWhereInput = {
      status: input.status,
      OR: input.search ? [
        { name: { contains: input.search, mode: "insensitive" } }
      ] : undefined
    };

    const [items, total] = await Promise.all([
      prisma.worker.findMany({
        where,
        include: {
          heartbeats: {
            orderBy: { createdAt: "desc" },
            take: 1
          },
          _count: { select: { executions: true, claimedJobs: true } }
        },
        orderBy: safeOrderBy(input.sortBy, ["startedAt", "lastHeartbeat", "name"], "lastHeartbeat", input.sortOrder),
        skip: (input.page - 1) * input.limit,
        take: input.limit
      }),
      prisma.worker.count({ where })
    ]);

    return createPaginationResult(items, total, input.page, input.limit);
  },
  markStaleWorkers: async () => {
    const stale = await prisma.worker.updateMany({
      where: {
        lastHeartbeat: { lt: new Date(Date.now() - 15000) },
        status: { in: [WorkerStatus.ACTIVE, WorkerStatus.IDLE] }
      },
      data: {
        status: WorkerStatus.STALE
      }
    });
    if (stale.count > 0) {
      realtime.emitWorkerUpdate({ staleWorkers: stale.count });
    }
    return stale;
  },
  requestShutdown: async (workerId: string) =>
    prisma.worker.update({
      where: { id: workerId },
      data: { shutdownRequestedAt: new Date(), status: WorkerStatus.STOPPING }
    })
};

export const metricsService = {
  getDashboardMetrics: async () => {
    const [groupedJobs, workers, avgDuration, throughput, queueStatuses] = await Promise.all([
      prisma.job.groupBy({
        by: ["status"],
        _count: { _all: true }
      }),
      prisma.worker.count({
        where: { lastHeartbeat: { gte: new Date(Date.now() - 15000) } }
      }),
      prisma.jobExecution.aggregate({
        _avg: { durationMs: true },
        where: { durationMs: { not: null } }
      }),
      prisma.$queryRaw<Array<{ minute_bucket: Date; completed: bigint; failed: bigint; retries: bigint }>>`
        SELECT date_trunc('minute', "createdAt") AS minute_bucket,
               COUNT(*) FILTER (WHERE status = 'COMPLETED')::bigint AS completed,
               COUNT(*) FILTER (WHERE status = 'FAILED')::bigint AS failed,
               COUNT(*) FILTER (WHERE status = 'RETRYING')::bigint AS retries
        FROM "Job"
        WHERE "createdAt" >= NOW() - interval '60 minutes'
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.queue.groupBy({
        by: ["status"],
        _count: { _all: true },
        where: { deletedAt: null }
      })
    ]);

    const completed = groupedJobs.find((item) => item.status === JobStatus.COMPLETED)?._count._all ?? 0;
    const failed = groupedJobs.find((item) => item.status === JobStatus.FAILED)?._count._all ?? 0;
    const retrying = groupedJobs.find((item) => item.status === JobStatus.RETRYING)?._count._all ?? 0;
    const queued = groupedJobs.find((item) => item.status === JobStatus.QUEUED)?._count._all ?? 0;
    const total = groupedJobs.reduce((sum, item) => sum + item._count._all, 0);
    const successRate = total === 0 ? 0 : Number(((completed / total) * 100).toFixed(2));

    return {
      completed,
      failed,
      retries: retrying,
      workerCount: workers,
      queueLength: queued,
      averageExecutionTimeMs: Math.round(avgDuration._avg.durationMs ?? 0),
      successRate,
      jobsPerSecond: Number((completed / 3600).toFixed(2)),
      failureRate: total === 0 ? 0 : Number(((failed / total) * 100).toFixed(2)),
      throughput: throughput.map((row) => ({
        bucket: row.minute_bucket,
        completed: Number(row.completed),
        failed: Number(row.failed),
        retries: Number(row.retries)
      })),
      queues: queueStatuses.map((row) => ({
        status: row.status,
        count: row._count._all
      }))
    };
  }
};

export const systemService = {
  bootstrapDashboard: async (userId: string) => {
    const [organizations, metrics, workers] = await Promise.all([
      orgService.listOrganizations(userId, { page: 1, limit: 5, sortOrder: "desc" }),
      metricsService.getDashboardMetrics(),
      workerService.listWorkers({ page: 1, limit: 5, sortOrder: "desc" })
    ]);

    return { organizations, metrics, workers };
  }
};
