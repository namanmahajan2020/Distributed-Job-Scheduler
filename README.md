# Distributed Job Scheduler

Production-inspired distributed job scheduler built as a TypeScript monorepo with an Express API, PostgreSQL/Prisma persistence layer, a dedicated worker runtime, and a React operations dashboard.

## Highlights

- Clean modular backend with auth, organizations, projects, queues, jobs, workers, scheduler, and realtime boundaries
- PostgreSQL-first design with atomic job claiming via `FOR UPDATE SKIP LOCKED`
- Retry policies with fixed, linear, and exponential backoff plus dead letter queue recovery
- Worker heartbeats, stale worker detection, and stale claim recovery
- React control plane with charts and operational views
- Dockerized local environment

## Monorepo

- `apps/api`: REST API, auth, scheduler loops, realtime
- `apps/worker`: distributed worker runtime
- `apps/web`: admin dashboard
- `packages/shared`: shared validation schemas
- `prisma`: relational schema
- `docs`: architecture and design artifacts

## Quick Start

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
docker compose up --build
```

## Core Design Choices

- Jobs are claimed atomically in Postgres to avoid duplicate execution across workers.
- Scheduling and stale-recovery run in the API process, while execution is isolated in workers.
- Retry behavior is queue-configurable and bounded by both queue policy and per-job policy.
- Soft deletes are used for projects and queues so operators retain auditability.

## Next Commands

```bash
npm run dev:api
npm run dev:worker
npm run dev:web
```
