# API Overview

## Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`

## Organizations and Projects

- `POST /api/organizations`
- `POST /api/organizations/:organizationId/invites`
- `GET /api/organizations/:organizationId/projects`
- `POST /api/projects`
- `PATCH /api/projects/:projectId`
- `DELETE /api/projects/:projectId`

## Queues and Jobs

- `POST /api/queues`
- `POST /api/queues/:queueId/pause`
- `POST /api/queues/:queueId/resume`
- `DELETE /api/queues/:queueId`
- `GET /api/queues/:queueId/stats`
- `POST /api/jobs`
- `GET /api/jobs`
- `POST /api/jobs/:jobId/retry`

## Operations

- `GET /api/workers`
- `GET /api/metrics`
- `GET /api/demo/bootstrap`
- `GET /api/demo/jobs`
- `GET /api/demo/workers`
