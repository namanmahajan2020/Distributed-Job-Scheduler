# System Architecture

```mermaid
flowchart LR
  Operator[Operator Browser]
  Web[React Dashboard]
  API[Express API<br/>Auth + Control Plane + Swagger + Socket.IO]
  Scheduler[Scheduler Loop<br/>Cron Promotion + Recovery + Recurring Trigger]
  WorkerA[Worker Runtime A]
  WorkerB[Worker Runtime B]
  DB[(PostgreSQL)]

  Operator --> Web
  Web --> API
  API --> DB
  API --> Scheduler
  Scheduler --> DB
  WorkerA --> DB
  WorkerB --> DB
  API --> WorkerA
  API --> WorkerB
  API --> Web
```

## Notes

- PostgreSQL is the system of record for queues, jobs, retries, worker liveness, and sessions.
- The API is the control plane and owns security, orchestration, and visibility concerns.
- Workers are horizontally scalable executors that coordinate exclusively through the database.
- Socket.IO is used for operational feedback rather than work distribution.
