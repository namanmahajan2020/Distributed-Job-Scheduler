import { Router } from "express";
import { z } from "zod";
import {
  createBatchJobSchema,
  createJobSchema,
  createOrganizationSchema,
  createProjectSchema,
  createQueueSchema,
  createRecurringJobSchema,
  inviteMemberSchema,
  jobQuerySchema,
  loginSchema,
  paginationSchema,
  projectQuerySchema,
  queueQuerySchema,
  refreshTokenSchema,
  registerSchema,
  updateProjectSchema,
  updateQueueSchema,
  updateRecurringJobSchema,
  workerQuerySchema
} from "@scheduler/shared";
import {
  asyncHandler,
  requireAuth,
  requireJobRole,
  requireOrgRole,
  requireProjectRole,
  requireQueueRole
} from "./middlewares";
import {
  authService,
  jobService,
  metricsService,
  orgService,
  projectService,
  queueService,
  recurringJobService,
  systemService,
  workerService
} from "./services";

export const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true }));

router.post("/auth/register", asyncHandler(async (req, res) => {
  const user = await authService.register(registerSchema.parse(req.body));
  res.status(201).json(user);
}));

router.post("/auth/login", asyncHandler(async (req, res) => {
  const result = await authService.login({
    ...loginSchema.parse(req.body),
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"]
  });
  res.json(result);
}));

router.post("/auth/refresh", asyncHandler(async (req, res) => {
  res.json(await authService.refresh(refreshTokenSchema.parse(req.body).refreshToken));
}));

router.post("/auth/logout", asyncHandler(async (req, res) => {
  await authService.logout(refreshTokenSchema.parse(req.body).refreshToken);
  res.status(204).send();
}));

router.get("/auth/me", requireAuth, asyncHandler(async (req, res) => {
  res.json(await authService.me(req.user!.id));
}));

router.get("/bootstrap", requireAuth, asyncHandler(async (req, res) => {
  res.json(await systemService.bootstrapDashboard(req.user!.id));
}));

router.get("/organizations", requireAuth, asyncHandler(async (req, res) => {
  res.json(await orgService.listOrganizations(req.user!.id, paginationSchema.parse(req.query)));
}));

router.post("/organizations", requireAuth, asyncHandler(async (req, res) => {
  res.status(201).json(await orgService.createOrganization(req.user!.id, createOrganizationSchema.parse(req.body)));
}));

router.post("/organizations/:organizationId/invites", requireAuth, requireOrgRole("ADMIN"), asyncHandler(async (req, res) => {
  const input = inviteMemberSchema.parse(req.body);
  res.status(201).json(await orgService.inviteMember(req.params.organizationId, input.email, input.role));
}));

router.get("/organizations/:organizationId/projects", requireAuth, requireOrgRole("ADMIN", "MEMBER", "VIEWER"), asyncHandler(async (req, res) => {
  res.json(await projectService.listProjects({
    ...projectQuerySchema.parse(req.query),
    organizationId: req.params.organizationId,
    userId: req.user!.id
  }));
}));

router.get("/projects", requireAuth, asyncHandler(async (req, res) => {
  res.json(await projectService.listProjects({
    ...projectQuerySchema.parse(req.query),
    userId: req.user!.id
  }));
}));

router.post("/projects", requireAuth, asyncHandler(async (req, res) => {
  res.status(201).json(await projectService.createProject(createProjectSchema.parse(req.body)));
}));

router.patch("/projects/:projectId", requireAuth, requireProjectRole("ADMIN", "MEMBER"), asyncHandler(async (req, res) => {
  res.json(await projectService.updateProject(req.params.projectId, updateProjectSchema.parse(req.body)));
}));

router.delete("/projects/:projectId", requireAuth, requireProjectRole("ADMIN"), asyncHandler(async (req, res) => {
  await projectService.deleteProject(req.params.projectId);
  res.status(204).send();
}));

router.get("/queues", requireAuth, asyncHandler(async (req, res) => {
  res.json(await queueService.listQueues(queueQuerySchema.parse(req.query)));
}));

router.post("/queues", requireAuth, asyncHandler(async (req, res) => {
  res.status(201).json(await queueService.createQueue(createQueueSchema.parse(req.body)));
}));

router.patch("/queues/:queueId", requireAuth, requireQueueRole("ADMIN", "MEMBER"), asyncHandler(async (req, res) => {
  res.json(await queueService.updateQueue(req.params.queueId, updateQueueSchema.parse(req.body)));
}));

router.post("/queues/:queueId/pause", requireAuth, requireQueueRole("ADMIN", "MEMBER"), asyncHandler(async (req, res) => {
  res.json(await queueService.pauseQueue(req.params.queueId));
}));

router.post("/queues/:queueId/resume", requireAuth, requireQueueRole("ADMIN", "MEMBER"), asyncHandler(async (req, res) => {
  res.json(await queueService.resumeQueue(req.params.queueId));
}));

router.delete("/queues/:queueId", requireAuth, requireQueueRole("ADMIN"), asyncHandler(async (req, res) => {
  res.json(await queueService.deleteQueue(req.params.queueId));
}));

router.get("/queues/:queueId/stats", requireAuth, requireQueueRole("ADMIN", "MEMBER", "VIEWER"), asyncHandler(async (req, res) => {
  res.json(await queueService.getQueueStats(req.params.queueId));
}));

router.post("/jobs", requireAuth, asyncHandler(async (req, res) => {
  res.status(201).json(await jobService.createJob(createJobSchema.parse(req.body)));
}));

router.post("/jobs/batch", requireAuth, asyncHandler(async (req, res) => {
  res.status(201).json(await jobService.createBatchJobs(createBatchJobSchema.parse(req.body)));
}));

router.get("/jobs", requireAuth, asyncHandler(async (req, res) => {
  res.json(await jobService.listJobs(jobQuerySchema.parse(req.query)));
}));

router.post("/jobs/:jobId/retry", requireAuth, requireJobRole("ADMIN", "MEMBER"), asyncHandler(async (req, res) => {
  res.json(await jobService.retryFromDlq(req.params.jobId, req.user!.id));
}));

router.post("/jobs/:jobId/cancel", requireAuth, requireJobRole("ADMIN", "MEMBER"), asyncHandler(async (req, res) => {
  res.json(await jobService.cancelJob(req.params.jobId, req.user!.id));
}));

router.get("/jobs/:jobId/logs", requireAuth, requireJobRole("ADMIN", "MEMBER", "VIEWER"), asyncHandler(async (req, res) => {
  res.json(await jobService.listJobLogs(req.params.jobId, paginationSchema.parse(req.query)));
}));

router.get("/recurring-jobs", requireAuth, asyncHandler(async (req, res) => {
  const schema = paginationSchema.extend({ queueId: z.string().cuid().optional() });
  res.json(await recurringJobService.listRecurringJobs(schema.parse(req.query)));
}));

router.post("/recurring-jobs", requireAuth, asyncHandler(async (req, res) => {
  res.status(201).json(await recurringJobService.createRecurringJob(createRecurringJobSchema.parse(req.body)));
}));

router.patch("/recurring-jobs/:scheduledJobId", requireAuth, asyncHandler(async (req, res) => {
  res.json(await recurringJobService.updateRecurringJob(req.params.scheduledJobId, updateRecurringJobSchema.parse(req.body)));
}));

router.delete("/recurring-jobs/:scheduledJobId", requireAuth, asyncHandler(async (req, res) => {
  res.json(await recurringJobService.deactivateRecurringJob(req.params.scheduledJobId));
}));

router.get("/workers", requireAuth, asyncHandler(async (req, res) => {
  res.json(await workerService.listWorkers(workerQuerySchema.parse(req.query)));
}));

router.get("/metrics", requireAuth, asyncHandler(async (_req, res) => {
  res.json(await metricsService.getDashboardMetrics());
}));
