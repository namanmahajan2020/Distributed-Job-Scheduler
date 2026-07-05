import { z } from "zod";

const slugSchema = z.string().min(2).max(50).regex(/^[a-z0-9-]+$/);
const jsonValueSchema: z.ZodTypeAny = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(jsonValueSchema)])
);

export const organizationRoleSchema = z.enum(["ADMIN", "MEMBER", "VIEWER"]);
export const retryStrategySchema = z.enum(["FIXED", "LINEAR", "EXPONENTIAL"]);
export const jobStatusSchema = z.enum(["QUEUED", "SCHEDULED", "CLAIMED", "RUNNING", "COMPLETED", "FAILED", "RETRYING", "DEAD_LETTER", "CANCELLED", "EXPIRED"]);
export const queueStatusSchema = z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]);
export const jobTypeSchema = z.enum(["IMMEDIATE", "DELAYED", "SCHEDULED", "RECURRING", "BATCH"]);
export const sortOrderSchema = z.enum(["asc", "desc"]).default("desc");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  sortBy: z.string().trim().optional(),
  sortOrder: sortOrderSchema
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(128),
  name: z.string().min(2).max(100)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1)
});

export const createOrganizationSchema = z.object({
  name: z.string().min(2).max(100),
  slug: slugSchema
});

export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: organizationRoleSchema
});

export const createProjectSchema = z.object({
  organizationId: z.string().cuid(),
  name: z.string().min(2).max(100),
  slug: slugSchema,
  description: z.string().max(500).optional()
});

export const updateProjectSchema = createProjectSchema.partial().omit({ organizationId: true, slug: true });

export const retryPolicySchema = z.object({
  strategy: retryStrategySchema,
  maxRetries: z.number().int().min(0).max(20),
  baseDelayMs: z.number().int().min(1000),
  maxDelayMs: z.number().int().min(1000),
  retryOnTimeout: z.boolean().default(true)
});

export const createQueueSchema = z.object({
  projectId: z.string().cuid(),
  name: z.string().min(2).max(100),
  slug: slugSchema,
  description: z.string().max(500).optional(),
  concurrencyLimit: z.number().int().min(1).max(100),
  maxWorkers: z.number().int().min(1).max(500),
  rateLimitPerMin: z.number().int().min(1).max(100000).optional(),
  priorityEnabled: z.boolean().default(true),
  retryPolicy: retryPolicySchema
});

export const updateQueueSchema = createQueueSchema.partial().omit({ projectId: true, slug: true });

export const createJobSchema = z.object({
  queueId: z.string().cuid(),
  name: z.string().min(2).max(120),
  type: jobTypeSchema,
  payload: z.record(jsonValueSchema),
  priority: z.number().int().min(0).max(100).default(0),
  scheduledFor: z.string().datetime().optional(),
  delaySeconds: z.number().int().min(1).max(60 * 60 * 24 * 30).optional(),
  expiresAt: z.string().datetime().optional(),
  batchKey: z.string().max(100).optional(),
  deduplicationKey: z.string().max(120).optional(),
  maxRetries: z.number().int().min(0).max(20).default(3),
  timeoutMs: z.number().int().min(1000).max(3600000).default(300000)
}).superRefine((value, ctx) => {
  if (value.type === "DELAYED" && !value.delaySeconds && !value.scheduledFor) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Delayed jobs require delaySeconds or scheduledFor" });
  }
  if (value.type === "SCHEDULED" && !value.scheduledFor) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Scheduled jobs require scheduledFor" });
  }
  if (value.type === "RECURRING") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Recurring jobs must be created through the recurring endpoint" });
  }
  if (value.type === "BATCH") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Batch jobs must be created through the batch endpoint" });
  }
});

export const createRecurringJobSchema = z.object({
  queueId: z.string().cuid(),
  name: z.string().min(2).max(120),
  cronExpression: z.string().min(5).max(120),
  payload: z.record(jsonValueSchema),
  timezone: z.string().min(2).max(100).default("UTC"),
  priority: z.number().int().min(0).max(100).default(0),
  maxRetries: z.number().int().min(0).max(20).default(3),
  timeoutMs: z.number().int().min(1000).max(3600000).default(300000),
  deduplicationKey: z.string().max(120).optional()
});

export const updateRecurringJobSchema = createRecurringJobSchema.partial().omit({ queueId: true });

export const createBatchJobSchema = z.object({
  queueId: z.string().cuid(),
  name: z.string().min(2).max(120),
  items: z.array(z.record(jsonValueSchema)).min(1).max(1000),
  priority: z.number().int().min(0).max(100).default(0),
  scheduledFor: z.string().datetime().optional(),
  maxRetries: z.number().int().min(0).max(20).default(3),
  timeoutMs: z.number().int().min(1000).max(3600000).default(300000)
});

export const queueQuerySchema = paginationSchema.extend({
  projectId: z.string().cuid().optional(),
  organizationId: z.string().cuid().optional(),
  status: queueStatusSchema.optional()
});

export const projectQuerySchema = paginationSchema.extend({
  organizationId: z.string().cuid().optional()
});

export const jobQuerySchema = paginationSchema.extend({
  queueId: z.string().cuid().optional(),
  projectId: z.string().cuid().optional(),
  status: jobStatusSchema.optional(),
  type: jobTypeSchema.optional(),
  batchKey: z.string().optional()
});

export const workerQuerySchema = paginationSchema.extend({
  status: z.enum(["ACTIVE", "IDLE", "STOPPING", "STOPPED", "STALE"]).optional()
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateQueueInput = z.infer<typeof createQueueSchema>;
export type CreateJobInput = z.infer<typeof createJobSchema>;
export type CreateRecurringJobInput = z.infer<typeof createRecurringJobSchema>;
export type CreateBatchJobInput = z.infer<typeof createBatchJobSchema>;
