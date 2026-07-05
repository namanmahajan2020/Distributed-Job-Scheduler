export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Distributed Job Scheduler API",
    version: "1.0.0",
    description: "Production-inspired API for organizations, queues, jobs, workers, metrics, and auth."
  },
  servers: [
    { url: "http://localhost:4000/api" }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    "/health": { get: { summary: "Health check", responses: { "200": { description: "Healthy" } } } },
    "/auth/register": { post: { summary: "Register a user", responses: { "201": { description: "Created" } } } },
    "/auth/login": { post: { summary: "Login", responses: { "200": { description: "Authenticated" } } } },
    "/auth/refresh": { post: { summary: "Rotate refresh token", responses: { "200": { description: "Rotated" } } } },
    "/auth/logout": { post: { summary: "Logout", responses: { "204": { description: "Logged out" } } } },
    "/auth/me": { get: { summary: "Current user", responses: { "200": { description: "User profile" } } } },
    "/organizations": { get: { summary: "List organizations", responses: { "200": { description: "Organizations" } } }, post: { summary: "Create organization", responses: { "201": { description: "Created" } } } },
    "/organizations/{organizationId}/projects": { get: { summary: "List organization projects", responses: { "200": { description: "Projects" } } } },
    "/organizations/{organizationId}/invites": { post: { summary: "Invite member", responses: { "201": { description: "Invite created" } } } },
    "/projects": { get: { summary: "List projects", responses: { "200": { description: "Projects" } } }, post: { summary: "Create project", responses: { "201": { description: "Created" } } } },
    "/projects/{projectId}": { patch: { summary: "Update project", responses: { "200": { description: "Updated" } } }, delete: { summary: "Delete project", responses: { "204": { description: "Deleted" } } } },
    "/queues": { get: { summary: "List queues", responses: { "200": { description: "Queues" } } }, post: { summary: "Create queue", responses: { "201": { description: "Created" } } } },
    "/queues/{queueId}": { patch: { summary: "Update queue", responses: { "200": { description: "Updated" } } }, delete: { summary: "Archive queue", responses: { "200": { description: "Archived" } } } },
    "/queues/{queueId}/pause": { post: { summary: "Pause queue", responses: { "200": { description: "Paused" } } } },
    "/queues/{queueId}/resume": { post: { summary: "Resume queue", responses: { "200": { description: "Resumed" } } } },
    "/queues/{queueId}/stats": { get: { summary: "Queue health and metrics", responses: { "200": { description: "Stats" } } } },
    "/jobs": { get: { summary: "List jobs", responses: { "200": { description: "Jobs" } } }, post: { summary: "Create job", responses: { "201": { description: "Created" } } } },
    "/jobs/batch": { post: { summary: "Create batch jobs", responses: { "201": { description: "Batch created" } } } },
    "/jobs/{jobId}/retry": { post: { summary: "Retry dead-letter job", responses: { "200": { description: "Queued" } } } },
    "/jobs/{jobId}/cancel": { post: { summary: "Cancel job", responses: { "200": { description: "Cancelled" } } } },
    "/jobs/{jobId}/logs": { get: { summary: "Job logs", responses: { "200": { description: "Logs" } } } },
    "/recurring-jobs": { get: { summary: "List recurring jobs", responses: { "200": { description: "Recurring jobs" } } }, post: { summary: "Create recurring job", responses: { "201": { description: "Created" } } } },
    "/recurring-jobs/{scheduledJobId}": { patch: { summary: "Update recurring job", responses: { "200": { description: "Updated" } } }, delete: { summary: "Deactivate recurring job", responses: { "200": { description: "Deactivated" } } } },
    "/workers": { get: { summary: "List workers", responses: { "200": { description: "Workers" } } } },
    "/metrics": { get: { summary: "Operational metrics", responses: { "200": { description: "Metrics" } } } }
  }
};
