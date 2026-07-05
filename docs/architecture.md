# Architecture

```mermaid
flowchart LR
  Browser[React Dashboard] --> API[Express API + Socket.IO]
  API --> PG[(PostgreSQL + Prisma)]
  API --> Scheduler[Cron Promotion + Recovery]
  WorkerA[Worker 1] --> PG
  WorkerB[Worker N] --> PG
  API --> WorkerA
  API --> WorkerB
```

## Execution Flow

1. Clients enqueue jobs through the API.
2. Jobs land in `QUEUED` or `SCHEDULED`.
3. Workers atomically claim eligible jobs with `FOR UPDATE SKIP LOCKED`.
4. Job execution records and logs are persisted per attempt.
5. Failures either reschedule using retry policy or move to DLQ.
