import { PrismaClient, JobStatus, WorkerStatus } from "@prisma/client";
import pino from "pino";
import os from "os";
import { env } from "./config";

const prisma = new PrismaClient();
const logger = pino({ level: "info", base: undefined });
const inflight = new Map<string, Promise<void>>();
let workerId = "";
let shuttingDown = false;
let heartbeatTimer: NodeJS.Timeout | undefined;
let pollTimer: NodeJS.Timeout | undefined;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function registerWorker() {
  const worker = await prisma.worker.upsert({
    where: { name: env.WORKER_NAME },
    create: {
      name: env.WORKER_NAME,
      status: WorkerStatus.IDLE,
      concurrency: env.WORKER_CONCURRENCY,
      lastHeartbeat: new Date()
    },
    update: {
      status: WorkerStatus.IDLE,
      concurrency: env.WORKER_CONCURRENCY,
      lastHeartbeat: new Date(),
      shutdownRequestedAt: null
    }
  });
  workerId = worker.id;
}

async function sendHeartbeat() {
  if (!workerId) return;
  const memoryMb = Math.round(process.memoryUsage().rss / 1024 / 1024);
  const worker = await prisma.worker.update({
    where: { id: workerId },
    data: {
      status: inflight.size > 0 ? WorkerStatus.ACTIVE : WorkerStatus.IDLE,
      lastHeartbeat: new Date(),
      heartbeats: {
        create: {
          activeJobs: inflight.size,
          memoryMb,
          cpuUsage: os.loadavg()[0] || 0
        }
      }
    }
  });
  logger.debug({ workerId: worker.id, inflight: inflight.size }, "heartbeat");
}

async function claimJobs() {
  if (shuttingDown) return [];

  const capacity = Math.max(env.WORKER_CONCURRENCY - inflight.size, 0);
  if (capacity === 0) return [];

  const claimLimit = Math.min(capacity, env.MAX_JOB_CLAIM_BATCH);
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH running_per_queue AS (
      SELECT "queueId", COUNT(*)::int AS running_count
      FROM "Job"
      WHERE status IN ('CLAIMED', 'RUNNING')
      GROUP BY "queueId"
    ),
    executed_last_minute AS (
      SELECT j."queueId", COUNT(*)::int AS recent_count
      FROM "JobExecution" e
      JOIN "Job" j ON j.id = e."jobId"
      WHERE e."createdAt" >= NOW() - interval '1 minute'
      GROUP BY j."queueId"
    ),
    eligible AS (
      SELECT
        j.id,
        j."queueId",
        q."concurrencyLimit",
        COALESCE(r.running_count, 0) AS running_count,
        q."rateLimitPerMin",
        COALESCE(ex.recent_count, 0) AS recent_count,
        ROW_NUMBER() OVER (PARTITION BY j."queueId" ORDER BY j.priority DESC, j."createdAt" ASC) AS queue_rank
      FROM "Job" j
      JOIN "Queue" q ON q.id = j."queueId"
      LEFT JOIN running_per_queue r ON r."queueId" = j."queueId"
      LEFT JOIN executed_last_minute ex ON ex."queueId" = j."queueId"
      WHERE j.status = 'QUEUED'
        AND q.status = 'ACTIVE'
        AND (j."scheduledFor" IS NULL OR j."scheduledFor" <= NOW())
        AND (j."expiresAt" IS NULL OR j."expiresAt" > NOW())
    ),
    candidate_jobs AS (
      SELECT id
      FROM eligible
      WHERE queue_rank <= GREATEST("concurrencyLimit" - running_count, 0)
        AND ("rateLimitPerMin" IS NULL OR recent_count < "rateLimitPerMin")
      ORDER BY queue_rank ASC
      LIMIT ${claimLimit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "Job" j
    SET status = 'CLAIMED',
        "claimedAt" = NOW(),
        "updatedAt" = NOW(),
        "currentWorkerId" = ${workerId}
    FROM candidate_jobs
    WHERE j.id = candidate_jobs.id
    RETURNING j.id
  `;

  return rows.map((row) => row.id);
}

async function runHandler(jobId: string) {
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { queue: { include: { retryPolicy: true } } }
  });

  const payload = job.payload as Record<string, unknown>;
  const simulateMs = typeof payload.simulateMs === "number" ? payload.simulateMs : 25;
  const shouldFail = Boolean(payload.shouldFail);
  const execution = async () => {
    await sleep(simulateMs);
    if (shouldFail) {
      throw new Error(String(payload.failMessage ?? "Simulated worker failure"));
    }
    return {
      acknowledged: true,
      worker: env.WORKER_NAME,
      payload
    };
  };

  return Promise.race([
    execution(),
    sleep(job.timeoutMs).then(() => {
      throw new Error("Job execution timed out");
    })
  ]);
}

async function executeJob(jobId: string) {
  const startedAt = new Date();

  try {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.RUNNING,
        startedAt
      }
    });

    const job = await prisma.job.findUniqueOrThrow({
      where: { id: jobId }
    });

    await prisma.jobExecution.create({
      data: {
        jobId,
        workerId,
        attempt: job.retryCount + 1,
        status: JobStatus.RUNNING,
        startedAt
      }
    });

    const output = await runHandler(jobId);
    const completedAt = new Date();

    await prisma.$transaction([
      prisma.job.update({
        where: { id: jobId },
        data: {
          status: JobStatus.COMPLETED,
          output: output as object,
          completedAt,
          errorMessage: null,
          currentWorkerId: null
        }
      }),
      prisma.jobExecution.updateMany({
        where: { jobId, workerId, status: JobStatus.RUNNING },
        data: {
          status: JobStatus.COMPLETED,
          completedAt,
          output: output as object,
          durationMs: completedAt.getTime() - startedAt.getTime()
        }
      }),
      prisma.jobLog.create({
        data: {
          jobId,
          level: "info",
          message: "Job completed",
          metadata: output as object
        }
      })
    ]);

    logger.info({ jobId }, "job completed");
  } catch (error) {
    const completedAt = new Date();
    const errorMessage = error instanceof Error ? error.message : "Unknown worker error";
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { queue: { include: { retryPolicy: true } } }
    });

    if (job?.queue.retryPolicy && job.retryCount + 1 <= Math.min(job.maxRetries, job.queue.retryPolicy.maxRetries)) {
      const attempt = job.retryCount + 1;
      const multiplier = job.queue.retryPolicy.strategy === "FIXED" ? 1 : job.queue.retryPolicy.strategy === "LINEAR" ? attempt : Math.pow(2, attempt - 1);
      const delayMs = Math.min(job.queue.retryPolicy.baseDelayMs * multiplier, job.queue.retryPolicy.maxDelayMs);

      await prisma.$transaction([
        prisma.job.update({
          where: { id: jobId },
          data: {
            status: JobStatus.RETRYING,
            retryCount: attempt,
            errorMessage,
            lastErrorAt: completedAt,
            scheduledFor: new Date(Date.now() + delayMs),
            currentWorkerId: null
          }
        }),
        prisma.jobExecution.updateMany({
          where: { jobId, workerId, status: JobStatus.RUNNING },
          data: {
            status: JobStatus.FAILED,
            completedAt,
            durationMs: completedAt.getTime() - startedAt.getTime(),
            errorMessage
          }
        }),
        prisma.jobLog.create({
          data: {
            jobId,
            level: "error",
            message: "Job failed and scheduled for retry",
            metadata: { errorMessage, retryAt: new Date(Date.now() + delayMs).toISOString() }
          }
        })
      ]);
    } else {
      await prisma.$transaction([
        prisma.job.update({
          where: { id: jobId },
          data: {
            status: JobStatus.DEAD_LETTER,
            retryCount: { increment: 1 },
            errorMessage,
            lastErrorAt: completedAt,
            currentWorkerId: null
          }
        }),
        prisma.deadLetterQueueEntry.upsert({
          where: { jobId },
          create: {
            jobId,
            reason: errorMessage
          },
          update: {
            reason: errorMessage,
            movedAt: completedAt
          }
        }),
        prisma.jobExecution.updateMany({
          where: { jobId, workerId, status: JobStatus.RUNNING },
          data: {
            status: JobStatus.FAILED,
            completedAt,
            durationMs: completedAt.getTime() - startedAt.getTime(),
            errorMessage
          }
        }),
        prisma.jobLog.create({
          data: {
            jobId,
            level: "error",
            message: "Job moved to dead letter queue",
            metadata: { errorMessage }
          }
        })
      ]);
    }

    logger.warn({ jobId, errorMessage }, "job failed");
  } finally {
    inflight.delete(jobId);
  }
}

async function poll() {
  if (shuttingDown) return;

  const claimedJobs = await claimJobs();
  for (const jobId of claimedJobs) {
    const promise = executeJob(jobId);
    inflight.set(jobId, promise);
    void promise;
  }
}

async function scheduleNextPoll() {
  await poll().catch((error) => logger.error({ error }, "poll failed"));
  if (!shuttingDown) {
    pollTimer = setTimeout(() => void scheduleNextPoll(), env.WORKER_POLL_INTERVAL_MS);
  }
}

async function recoverStaleClaims() {
  await prisma.job.updateMany({
    where: {
      status: { in: [JobStatus.CLAIMED, JobStatus.RUNNING] },
      claimedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) }
    },
    data: {
      status: JobStatus.QUEUED,
      claimedAt: null,
      startedAt: null,
      currentWorkerId: null
    }
  });
}

async function requeueOwnedClaims() {
  if (!workerId) return;
  await prisma.job.updateMany({
    where: {
      currentWorkerId: workerId,
      status: { in: [JobStatus.CLAIMED, JobStatus.RUNNING] }
    },
    data: {
      status: JobStatus.QUEUED,
      claimedAt: null,
      startedAt: null,
      currentWorkerId: null
    }
  });
}

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal, inflight: inflight.size }, "shutdown requested");

  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (pollTimer) clearTimeout(pollTimer);

  if (workerId) {
    await prisma.worker.update({
      where: { id: workerId },
      data: { status: WorkerStatus.STOPPING, shutdownRequestedAt: new Date() }
    }).catch(() => undefined);
  }

  const inflightWork = Promise.allSettled(Array.from(inflight.values()));
  await Promise.race([inflightWork, sleep(env.WORKER_SHUTDOWN_TIMEOUT_MS)]);
  await requeueOwnedClaims();

  if (workerId) {
    await prisma.worker.update({
      where: { id: workerId },
      data: { status: WorkerStatus.STOPPED, lastHeartbeat: new Date() }
    }).catch(() => undefined);
  }

  await prisma.$disconnect();
  process.exit(0);
}

async function main() {
  await registerWorker();
  await recoverStaleClaims();
  heartbeatTimer = setInterval(() => void sendHeartbeat().catch((error) => logger.error({ error }, "heartbeat failed")), env.WORKER_HEARTBEAT_INTERVAL_MS);
  await sendHeartbeat();
  await scheduleNextPoll();
  logger.info({ workerId, workerName: env.WORKER_NAME }, "worker started");
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

void main().catch(async (error) => {
  logger.error({ error }, "worker failed to start");
  await prisma.$disconnect();
  process.exit(1);
});
