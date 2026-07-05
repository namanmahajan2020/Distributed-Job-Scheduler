import { prisma } from "./lib/prisma";
import { hashPassword } from "./lib/auth";

async function seed() {
  const passwordHash = await hashPassword("Password123!");
  const user = await prisma.user.upsert({
    where: { email: "admin@scheduler.local" },
    create: { email: "admin@scheduler.local", name: "Admin User", passwordHash },
    update: { name: "Admin User" }
  });

  const member = await prisma.user.upsert({
    where: { email: "member@scheduler.local" },
    create: { email: "member@scheduler.local", name: "Member User", passwordHash },
    update: { name: "Member User" }
  });

  const organization = await prisma.organization.upsert({
    where: { slug: "acme" },
    create: {
      name: "Acme Inc.",
      slug: "acme"
    },
    update: {}
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: user.id
      }
    },
    create: { organizationId: organization.id, userId: user.id, role: "ADMIN" },
    update: { role: "ADMIN" }
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: member.id
      }
    },
    create: { organizationId: organization.id, userId: member.id, role: "MEMBER" },
    update: { role: "MEMBER" }
  });

  const project = await prisma.project.upsert({
    where: { organizationId_slug: { organizationId: organization.id, slug: "payments" } },
    create: {
      organizationId: organization.id,
      name: "Payments",
      slug: "payments",
      description: "Critical async payment workflows"
    },
    update: {
      description: "Critical async payment workflows"
    }
  });

  const queue = await prisma.queue.upsert({
    where: { projectId_slug: { projectId: project.id, slug: "critical" } },
    create: {
      projectId: project.id,
      name: "Critical Jobs",
      slug: "critical",
      description: "High priority payment tasks",
      concurrencyLimit: 10,
      maxWorkers: 20,
      rateLimitPerMin: 120,
      retryPolicy: {
        create: {
          strategy: "EXPONENTIAL",
          maxRetries: 5,
          baseDelayMs: 10000,
          maxDelayMs: 300000,
          retryOnTimeout: true
        }
      }
    },
    update: {
      description: "High priority payment tasks",
      rateLimitPerMin: 120
    },
    include: { retryPolicy: true }
  });

  if (!queue.retryPolicy) {
    await prisma.retryPolicy.create({
      data: {
        queueId: queue.id,
        strategy: "EXPONENTIAL",
        maxRetries: 5,
        baseDelayMs: 10000,
        maxDelayMs: 300000,
        retryOnTimeout: true
      }
    });
  }

  const delayedAt = new Date(Date.now() + 15 * 60 * 1000);
  const scheduledAt = new Date(Date.now() + 30 * 60 * 1000);

  const recurring = await prisma.scheduledJob.upsert({
    where: { id: "seed-recurring-critical" },
    create: {
      id: "seed-recurring-critical",
      queueId: queue.id,
      name: "Daily reconciliation",
      cronExpression: "* * * * *",
      payload: { kind: "reconciliation", source: "seed" },
      timezone: "UTC",
      priority: 80,
      maxRetries: 4,
      timeoutMs: 30000
    },
    update: {
      active: true,
      queueId: queue.id
    }
  });

  const immediateJob = await prisma.job.create({
    data: {
      queueId: queue.id,
      type: "IMMEDIATE",
      status: "QUEUED",
      name: "Send payout webhook",
      payload: { event: "payout.created", simulateMs: 500 },
      priority: 90,
      maxRetries: 3,
      timeoutMs: 15000
    }
  }).catch(() => null);

  await prisma.job.create({
    data: {
      queueId: queue.id,
      type: "DELAYED",
      status: "SCHEDULED",
      name: "Delayed refund sync",
      payload: { event: "refund.sync" },
      priority: 50,
      scheduledFor: delayedAt,
      maxRetries: 2,
      timeoutMs: 10000,
      deduplicationKey: `seed-delayed-${delayedAt.toISOString()}`
    }
  }).catch(() => null);

  await prisma.job.create({
    data: {
      queueId: queue.id,
      type: "SCHEDULED",
      status: "SCHEDULED",
      name: "Scheduled ledger export",
      payload: { event: "ledger.export" },
      priority: 40,
      scheduledFor: scheduledAt,
      maxRetries: 2,
      timeoutMs: 10000,
      deduplicationKey: `seed-scheduled-${scheduledAt.toISOString()}`
    }
  }).catch(() => null);

  await prisma.job.createMany({
    data: [
      {
        queueId: queue.id,
        type: "BATCH",
        status: "QUEUED",
        name: "Batch settlement #1",
        payload: { accountId: "acct_1", amount: 1000 },
        priority: 60,
        batchKey: "seed-batch-1",
        batchSize: 2,
        batchIndex: 0
      },
      {
        queueId: queue.id,
        type: "BATCH",
        status: "QUEUED",
        name: "Batch settlement #2",
        payload: { accountId: "acct_2", amount: 1500 },
        priority: 60,
        batchKey: "seed-batch-1",
        batchSize: 2,
        batchIndex: 1
      }
    ],
    skipDuplicates: true
  });

  if (immediateJob) {
    await prisma.jobLog.createMany({
      data: [
        { jobId: immediateJob.id, level: "info", message: "Seeded immediate job" },
        { jobId: immediateJob.id, level: "info", message: "Ready for worker claim", metadata: { queue: queue.slug, recurring: recurring.id } }
      ]
    });
  }
}

seed()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
