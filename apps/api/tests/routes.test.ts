import express from "express";
import request from "supertest";

const serviceMocks = {
  authService: {
    register: jest.fn().mockResolvedValue({ id: "user_1" }),
    login: jest.fn().mockResolvedValue({ accessToken: "access", refreshToken: "refresh", user: { id: "user_1" } }),
    refresh: jest.fn().mockResolvedValue({ accessToken: "next-access", refreshToken: "next-refresh" }),
    logout: jest.fn().mockResolvedValue(undefined),
    me: jest.fn().mockResolvedValue({ id: "user_1" })
  },
  systemService: { bootstrapDashboard: jest.fn().mockResolvedValue({ ok: true }) },
  orgService: {
    listOrganizations: jest.fn().mockResolvedValue({ items: [] }),
    createOrganization: jest.fn().mockResolvedValue({ id: "org_1" }),
    inviteMember: jest.fn().mockResolvedValue({ id: "invite_1" })
  },
  projectService: {
    listProjects: jest.fn().mockResolvedValue({ items: [] }),
    createProject: jest.fn().mockResolvedValue({ id: "project_1" }),
    updateProject: jest.fn().mockResolvedValue({ id: "project_1" }),
    deleteProject: jest.fn().mockResolvedValue(undefined)
  },
  queueService: {
    listQueues: jest.fn().mockResolvedValue({ items: [] }),
    createQueue: jest.fn().mockResolvedValue({ id: "queue_1" }),
    updateQueue: jest.fn().mockResolvedValue({ id: "queue_1" }),
    pauseQueue: jest.fn().mockResolvedValue({ id: "queue_1", status: "PAUSED" }),
    resumeQueue: jest.fn().mockResolvedValue({ id: "queue_1", status: "ACTIVE" }),
    deleteQueue: jest.fn().mockResolvedValue({ id: "queue_1", status: "ARCHIVED" }),
    getQueueStats: jest.fn().mockResolvedValue({ queue: { id: "queue_1" } })
  },
  jobService: {
    createJob: jest.fn().mockResolvedValue({ id: "job_1" }),
    createBatchJobs: jest.fn().mockResolvedValue({ batchKey: "batch_1", count: 2 }),
    listJobs: jest.fn().mockResolvedValue({ items: [] }),
    retryFromDlq: jest.fn().mockResolvedValue({ id: "job_1" }),
    cancelJob: jest.fn().mockResolvedValue({ id: "job_1", status: "CANCELLED" }),
    listJobLogs: jest.fn().mockResolvedValue({ items: [] })
  },
  recurringJobService: {
    listRecurringJobs: jest.fn().mockResolvedValue({ items: [] }),
    createRecurringJob: jest.fn().mockResolvedValue({ id: "scheduled_1" }),
    updateRecurringJob: jest.fn().mockResolvedValue({ id: "scheduled_1" }),
    deactivateRecurringJob: jest.fn().mockResolvedValue({ id: "scheduled_1", active: false })
  },
  workerService: {
    listWorkers: jest.fn().mockResolvedValue({ items: [] })
  },
  metricsService: {
    getDashboardMetrics: jest.fn().mockResolvedValue({ completed: 0 })
  }
};

jest.mock("../src/services", () => serviceMocks);

jest.mock("../src/middlewares", () => ({
  asyncHandler: (fn: any) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next),
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: "user_1", memberships: [{ organizationId: "org_1", role: "ADMIN" }] };
    next();
  },
  requireOrgRole: () => (_req: any, _res: any, next: any) => next(),
  requireProjectRole: () => (_req: any, _res: any, next: any) => next(),
  requireQueueRole: () => (_req: any, _res: any, next: any) => next(),
  requireJobRole: () => (_req: any, _res: any, next: any) => next()
}));

describe("routes", () => {
  let app: express.Express;

  beforeAll(async () => {
    const { router } = await import("../src/routes");
    app = express();
    app.use(express.json());
    app.use("/api", router);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("covers the expanded API surface", async () => {
    await request(app).post("/api/auth/register").send({ email: "a@test.dev", password: "Password123!", name: "A User" }).expect(201);
    await request(app).post("/api/auth/login").send({ email: "a@test.dev", password: "Password123!" }).expect(200);
    await request(app).post("/api/auth/refresh").send({ refreshToken: "refresh" }).expect(200);
    await request(app).post("/api/auth/logout").send({ refreshToken: "refresh" }).expect(204);
    await request(app).get("/api/auth/me").expect(200);
    await request(app).get("/api/bootstrap").expect(200);
    await request(app).get("/api/organizations").expect(200);
    await request(app).post("/api/organizations").send({ name: "Org", slug: "org" }).expect(201);
    await request(app).post("/api/organizations/org_1/invites").send({ email: "member@test.dev", role: "MEMBER" }).expect(201);
    await request(app).get("/api/organizations/org_1/projects").expect(200);
    await request(app).get("/api/projects").expect(200);
    await request(app).post("/api/projects").send({ organizationId: "ck1234567890123456789012", name: "Project", slug: "project" }).expect(201);
    await request(app).patch("/api/projects/project_1").send({ name: "Project 2" }).expect(200);
    await request(app).delete("/api/projects/project_1").expect(204);
    await request(app).get("/api/queues").expect(200);
    await request(app).post("/api/queues").send({
      projectId: "ck1234567890123456789012",
      name: "Queue",
      slug: "queue",
      concurrencyLimit: 5,
      maxWorkers: 5,
      retryPolicy: { strategy: "FIXED", maxRetries: 2, baseDelayMs: 1000, maxDelayMs: 5000, retryOnTimeout: true }
    }).expect(201);
    await request(app).patch("/api/queues/queue_1").send({ name: "Queue 2" }).expect(200);
    await request(app).post("/api/queues/queue_1/pause").expect(200);
    await request(app).post("/api/queues/queue_1/resume").expect(200);
    await request(app).delete("/api/queues/queue_1").expect(200);
    await request(app).get("/api/queues/queue_1/stats").expect(200);
    await request(app).post("/api/jobs").send({
      queueId: "ck1234567890123456789012",
      name: "Job",
      type: "IMMEDIATE",
      payload: { ok: true },
      priority: 1,
      maxRetries: 1,
      timeoutMs: 1000
    }).expect(201);
    await request(app).post("/api/jobs/batch").send({
      queueId: "ck1234567890123456789012",
      name: "Batch",
      items: [{ ok: true }],
      priority: 1,
      maxRetries: 1,
      timeoutMs: 1000
    }).expect(201);
    await request(app).get("/api/jobs").expect(200);
    await request(app).post("/api/jobs/job_1/retry").expect(200);
    await request(app).post("/api/jobs/job_1/cancel").expect(200);
    await request(app).get("/api/jobs/job_1/logs").expect(200);
    await request(app).get("/api/recurring-jobs").expect(200);
    await request(app).post("/api/recurring-jobs").send({
      queueId: "ck1234567890123456789012",
      name: "Recurring",
      cronExpression: "* * * * *",
      payload: { ok: true },
      priority: 1,
      maxRetries: 1,
      timeoutMs: 1000,
      timezone: "UTC"
    }).expect(201);
    await request(app).patch("/api/recurring-jobs/scheduled_1").send({ name: "Recurring 2" }).expect(200);
    await request(app).delete("/api/recurring-jobs/scheduled_1").expect(200);
    await request(app).get("/api/workers").expect(200);
    await request(app).get("/api/metrics").expect(200);
  });
});
