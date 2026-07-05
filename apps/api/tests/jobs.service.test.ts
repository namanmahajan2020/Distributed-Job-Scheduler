import { JobStatus, JobType, QueueStatus } from "@prisma/client";
import { jobService } from "../src/services";
import { prisma } from "../src/lib/prisma";

jest.mock("../src/lib/prisma", () => ({
  prisma: {
    queue: { findUnique: jest.fn() },
    job: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn()
    },
    jobLog: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    deadLetterQueueEntry: { delete: jest.fn(), upsert: jest.fn() },
    $transaction: jest.fn(async (callbackOrActions: any) => {
      if (typeof callbackOrActions === "function") {
        return callbackOrActions({
          job: prisma.job,
          deadLetterQueueEntry: prisma.deadLetterQueueEntry
        });
      }
      return Promise.all(callbackOrActions);
    })
  }
}));

describe("jobService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates an immediate job as queued", async () => {
    (prisma.queue.findUnique as jest.Mock).mockResolvedValue({ id: "queue_1", status: QueueStatus.ACTIVE, retryPolicy: null });
    (prisma.job.create as jest.Mock).mockResolvedValue({ id: "job_1", status: JobStatus.QUEUED });
    (prisma.jobLog.create as jest.Mock).mockResolvedValue({});

    const job = await jobService.createJob({
      queueId: "queue_1",
      name: "Example Job",
      type: "IMMEDIATE",
      payload: { ok: true },
      priority: 1,
      maxRetries: 3,
      timeoutMs: 1000
    });

    expect(job.status).toBe(JobStatus.QUEUED);
  });

  it("creates a scheduled job when scheduledFor is provided", async () => {
    (prisma.queue.findUnique as jest.Mock).mockResolvedValue({ id: "queue_1", status: QueueStatus.ACTIVE, retryPolicy: null });
    (prisma.job.create as jest.Mock).mockResolvedValue({ id: "job_2", status: JobStatus.SCHEDULED });
    (prisma.jobLog.create as jest.Mock).mockResolvedValue({});

    const job = await jobService.createJob({
      queueId: "queue_1",
      name: "Scheduled",
      type: "SCHEDULED",
      payload: { ok: true },
      priority: 1,
      scheduledFor: new Date(Date.now() + 10_000).toISOString(),
      maxRetries: 3,
      timeoutMs: 1000
    });

    expect(job.status).toBe(JobStatus.SCHEDULED);
  });

  it("creates a batch of jobs", async () => {
    (prisma.job.create as jest.Mock)
      .mockResolvedValueOnce({ id: "job_1", batchIndex: 0, batchSize: 2 })
      .mockResolvedValueOnce({ id: "job_2", batchIndex: 1, batchSize: 2 });
    (prisma.jobLog.create as jest.Mock).mockResolvedValue({});

    const result = await jobService.createBatchJobs({
      queueId: "queue_1",
      name: "Batch",
      items: [{ a: 1 }, { a: 2 }],
      priority: 10,
      maxRetries: 3,
      timeoutMs: 1000
    });

    expect(result.count).toBe(2);
    expect(result.batchKey).toContain("batch_");
  });

  it("cancels a job", async () => {
    (prisma.job.update as jest.Mock).mockResolvedValue({ id: "job_1", status: JobStatus.CANCELLED });
    (prisma.jobLog.create as jest.Mock).mockResolvedValue({});

    const job = await jobService.cancelJob("job_1", "user_1");
    expect(job.status).toBe(JobStatus.CANCELLED);
  });

  it("lists paginated jobs", async () => {
    (prisma.job.findMany as jest.Mock).mockResolvedValue([{ id: "job_1", type: JobType.IMMEDIATE }]);
    (prisma.job.count as jest.Mock).mockResolvedValue(1);

    const result = await jobService.listJobs({ page: 1, limit: 20, sortOrder: "desc" });
    expect(result.meta.total).toBe(1);
    expect(result.items).toHaveLength(1);
  });
});
