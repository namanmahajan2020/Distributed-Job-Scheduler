# ER Diagram

```mermaid
erDiagram
  USER ||--o{ ORGANIZATION_MEMBER : joins
  ORGANIZATION ||--o{ ORGANIZATION_MEMBER : owns
  ORGANIZATION ||--o{ ORGANIZATION_INVITE : issues
  ORGANIZATION ||--o{ PROJECT : contains
  PROJECT ||--o{ QUEUE : contains
  QUEUE ||--o| RETRY_POLICY : configures
  QUEUE ||--o{ SCHEDULED_JOB : schedules
  QUEUE ||--o{ JOB : enqueues
  SCHEDULED_JOB ||--o{ JOB : materializes
  JOB ||--o{ JOB_EXECUTION : executes
  JOB ||--o{ JOB_LOG : logs
  JOB ||--o| DEAD_LETTER_QUEUE_ENTRY : escalates_to
  WORKER ||--o{ WORKER_HEARTBEAT : emits
  WORKER ||--o{ JOB_EXECUTION : runs
  WORKER ||--o{ JOB : claims
  USER ||--o{ SESSION : opens
  SESSION ||--o{ REFRESH_TOKEN : rotates
```

## Core Relationships

- organizations own projects and membership boundaries
- projects own queues
- queues own jobs and recurring schedules
- jobs produce execution attempts, logs, and optional DLQ records
- users own sessions and refresh tokens for auth rotation
