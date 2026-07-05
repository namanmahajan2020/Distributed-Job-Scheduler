# API Documentation

Base URL: `http://localhost:4000/api`

## Conventions

- Authentication: `Authorization: Bearer <access-token>`
- Content type: `application/json`
- Error envelope:

```json
{
  "error": {
    "message": "Human readable message",
    "details": null,
    "requestId": "uuid"
  }
}
```

## Auth

### POST `/auth/register`

- Authentication: none
- Request body:

```json
{
  "email": "admin@scheduler.local",
  "password": "Password123!",
  "name": "Admin User"
}
```

- Success: `201`
- Errors: `400`, `409`

### POST `/auth/login`

- Authentication: none
- Request body:

```json
{
  "email": "admin@scheduler.local",
  "password": "Password123!"
}
```

- Success response:

```json
{
  "user": {
    "id": "user_id",
    "email": "admin@scheduler.local",
    "name": "Admin User"
  },
  "accessToken": "jwt",
  "refreshToken": "jwt"
}
```

- Errors: `401`

### POST `/auth/refresh`

- Authentication: none
- Request body:

```json
{
  "refreshToken": "jwt"
}
```

- Success: rotated access and refresh token pair
- Errors: `401`

### POST `/auth/logout`

- Authentication: none
- Request body:

```json
{
  "refreshToken": "jwt"
}
```

- Success: `204`

### GET `/auth/me`

- Authentication: required
- Success: current user and memberships

## Organizations

### GET `/organizations`

- Authentication: required
- Query: `page`, `limit`, `search`, `sortBy`, `sortOrder`
- Success: paginated organizations visible to the user

### POST `/organizations`

- Authentication: required
- Request body:

```json
{
  "name": "Acme Inc.",
  "slug": "acme"
}
```

- Success: `201`

### POST `/organizations/:organizationId/invites`

- Authentication: admin in organization
- Request body:

```json
{
  "email": "member@example.com",
  "role": "MEMBER"
}
```

- Success: invite record with token and expiry

### GET `/organizations/:organizationId/projects`

- Authentication: admin, member, or viewer in organization
- Query: pagination and sorting

## Projects

### GET `/projects`

- Authentication: required
- Query: `organizationId`, `page`, `limit`, `search`, `sortBy`, `sortOrder`

### POST `/projects`

- Authentication: required
- Request body:

```json
{
  "organizationId": "cuid",
  "name": "Payments",
  "slug": "payments",
  "description": "Critical background workflows"
}
```

### PATCH `/projects/:projectId`

- Authentication: admin or member with project access
- Request body: partial mutable fields

### DELETE `/projects/:projectId`

- Authentication: admin
- Behavior: soft delete

## Queues

### GET `/queues`

- Authentication: required
- Query:
  - `projectId`
  - `organizationId`
  - `status`
  - pagination and sorting fields

### POST `/queues`

- Authentication: required
- Request body:

```json
{
  "projectId": "cuid",
  "name": "Critical Jobs",
  "slug": "critical",
  "description": "High priority queue",
  "concurrencyLimit": 10,
  "maxWorkers": 20,
  "rateLimitPerMin": 120,
  "priorityEnabled": true,
  "retryPolicy": {
    "strategy": "EXPONENTIAL",
    "maxRetries": 5,
    "baseDelayMs": 10000,
    "maxDelayMs": 300000,
    "retryOnTimeout": true
  }
}
```

### PATCH `/queues/:queueId`

- Authentication: admin or member
- Request body: mutable queue settings

### POST `/queues/:queueId/pause`

- Authentication: admin or member
- Success: queue status becomes `PAUSED`

### POST `/queues/:queueId/resume`

- Authentication: admin or member
- Success: queue status becomes `ACTIVE`

### DELETE `/queues/:queueId`

- Authentication: admin
- Behavior: soft archive

### GET `/queues/:queueId/stats`

- Authentication: viewer or above
- Response includes:
  - queue config
  - grouped job counts
  - active worker count
  - throughput time series
  - recent failures

## Jobs

### POST `/jobs`

- Authentication: required
- Supports `IMMEDIATE`, `DELAYED`, and `SCHEDULED`
- Request example:

```json
{
  "queueId": "cuid",
  "name": "Send payout webhook",
  "type": "IMMEDIATE",
  "payload": {
    "event": "payout.created",
    "simulateMs": 500
  },
  "priority": 90,
  "maxRetries": 3,
  "timeoutMs": 15000
}
```

### POST `/jobs/batch`

- Authentication: required
- Request example:

```json
{
  "queueId": "cuid",
  "name": "Settlement batch",
  "items": [
    { "accountId": "acct_1", "amount": 1000 },
    { "accountId": "acct_2", "amount": 1500 }
  ],
  "priority": 60,
  "maxRetries": 3,
  "timeoutMs": 30000
}
```

- Response: `batchKey`, count, created jobs

### GET `/jobs`

- Authentication: required
- Query:
  - `queueId`
  - `projectId`
  - `status`
  - `type`
  - `batchKey`
  - `search`
  - `page`
  - `limit`
  - `sortBy`
  - `sortOrder`

### POST `/jobs/:jobId/retry`

- Authentication: admin or member
- Success: requeues a dead-lettered job

### POST `/jobs/:jobId/cancel`

- Authentication: admin or member
- Success: marks cancellable job as `CANCELLED`

### GET `/jobs/:jobId/logs`

- Authentication: viewer or above
- Response: paginated job log rows

## Recurring Jobs

### GET `/recurring-jobs`

- Authentication: required
- Query: `queueId`, pagination, sorting

### POST `/recurring-jobs`

- Authentication: required
- Request example:

```json
{
  "queueId": "cuid",
  "name": "Daily reconciliation",
  "cronExpression": "* * * * *",
  "payload": {
    "kind": "reconciliation"
  },
  "timezone": "UTC",
  "priority": 80,
  "maxRetries": 4,
  "timeoutMs": 30000
}
```

### PATCH `/recurring-jobs/:scheduledJobId`

- Authentication: required
- Request body: partial update

### DELETE `/recurring-jobs/:scheduledJobId`

- Authentication: required
- Behavior: deactivates the schedule

## Workers

### GET `/workers`

- Authentication: required
- Query:
  - `status`
  - `search`
  - pagination and sorting

## Metrics

### GET `/metrics`

- Authentication: required
- Response includes:
  - completed, failed, retried, queued counts
  - worker count
  - average execution time
  - success and failure rates
  - jobs per second
  - queue status summary
  - throughput time series
