# Distributed Job Scheduler

[![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/API%20Coverage-89.65%25-brightgreen)](./apps/api/jest.config.js)

Production-inspired distributed job scheduler built as a TypeScript monorepo with an Express API, PostgreSQL persistence, Prisma ORM, a dedicated worker runtime, and a React control plane for queue and worker operations.

## Banner

The project models a real-world asynchronous job orchestration platform with:

- authenticated multi-tenant organizations and projects
- queue configuration with concurrency, retry, and rate limit controls
- distributed workers with atomic job claiming and graceful shutdown
- real-time operational visibility via Socket.IO
- a responsive dashboard for queues, jobs, workers, and metrics

## Project Description

Distributed Job Scheduler is designed as a backend-heavy systems assignment with production-oriented engineering choices. It focuses on correctness under concurrency, operational visibility, maintainability, and extensibility. The implementation uses PostgreSQL as the coordination layer for durable queue state, retries, dead-letter handling, and worker recovery semantics.

## Table Of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Folder Structure](#folder-structure)
5. [Installation](#installation)
6. [Running Locally](#running-locally)
7. [Docker Setup](#docker-setup)
8. [Environment Variables](#environment-variables)
9. [API Documentation](#api-documentation)
10. [Authentication](#authentication)
11. [Queue System](#queue-system)
12. [Worker System](#worker-system)
13. [Retry Policies](#retry-policies)
14. [Dead Letter Queue](#dead-letter-queue)
15. [Scheduler](#scheduler)
16. [Dashboard](#dashboard)
17. [Database Schema](#database-schema)
18. [Screenshots](#screenshots)
19. [System Architecture](#system-architecture)
20. [ER Diagram](#er-diagram)
21. [Sequence Diagram](#sequence-diagram)
22. [Performance](#performance)
23. [Security](#security)
24. [Testing](#testing)
25. [Deployment](#deployment)
26. [Future Enhancements](#future-enhancements)
27. [Roadmap](#roadmap)
28. [Contributing](#contributing)
29. [License](#license)
30. [Acknowledgements](#acknowledgements)
31. [GitHub Repository](#github-repository)

## Features

- JWT authentication with refresh token rotation and session tracking
- role-based access control for admins, members, and viewers
- organizations, member invites, projects, and queue ownership boundaries
- immediate, delayed, scheduled, recurring, and batch jobs
- queue pause and resume workflows
- retry policies with fixed, linear, and exponential backoff
- dead letter queue recovery flow
- worker heartbeats, stale-worker detection, and shutdown-aware requeueing
- Socket.IO operational snapshots and live update channels
- admin dashboard with queue, job, worker, and metric views
- OpenAPI and Swagger UI for the REST surface
- Prisma schema with relational integrity and operational indexes
- Dockerized local development footprint

## Architecture

The system is implemented as a modular monorepo:

- `apps/api` is the control plane. It owns authentication, queue and job management, scheduling, metrics aggregation, and Swagger/Socket.IO exposure.
- `apps/worker` is the execution plane. It polls eligible jobs, claims work atomically from PostgreSQL, executes handlers, updates job lifecycle state, and handles graceful shutdown.
- `apps/web` is the operator UI. It authenticates with the API, renders queue and worker health, and reacts to live updates.
- `packages/shared` contains validation contracts reused across API boundaries.
- `prisma` owns the relational schema and later migration history.

Design references:

- [Architecture Notes](./docs/architecture.md)
- [Design Decisions](./docs/design-decisions.md)
- [Audit Checklist](./docs/audit-checklist.md)

## Technology Stack

### Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query
- Axios
- Chart.js
- Socket.IO Client

### Backend

- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL
- JWT
- bcrypt
- Zod
- Pino
- Socket.IO
- node-cron

### Tooling And Ops

- Docker
- Docker Compose
- Jest
- Supertest

## Folder Structure

```text
.
├── apps
│   ├── api
│   │   ├── src
│   │   └── tests
│   ├── web
│   │   └── src
│   └── worker
│       └── src
├── docs
│   ├── screenshots
│   ├── api.md
│   ├── architecture.md
│   ├── audit-checklist.md
│   ├── authentication-flow.md
│   ├── deployment-diagram.md
│   ├── deployment.md
│   ├── design-decisions.md
│   ├── er-diagram.md
│   ├── folder-structure.md
│   ├── queue-flow.md
│   ├── retry-flow.md
│   ├── sequence-diagram.md
│   └── worker-flow.md
├── packages
│   └── shared
├── prisma
│   └── schema.prisma
├── docker-compose.yml
├── package.json
└── RA2311003011711.md
```

Detailed view:

- [Folder Structure Diagram](./docs/folder-structure.md)

## Installation

```bash
npm install
npm run prisma:generate
```

## Running Locally

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL or use Docker Compose.
3. Generate Prisma client.
4. Run migrations.
5. Seed the database.
6. Start the API, worker, and web applications.

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev:api
npm run dev:worker
npm run dev:web
```

Default seed credentials:

- `admin@scheduler.local` / `Password123!`
- `member@scheduler.local` / `Password123!`

## Docker Setup

The repository includes a development-oriented Docker Compose file for PostgreSQL, the API, worker, and dashboard services.

```bash
docker compose up --build
```

Recommended flow:

```bash
docker compose up -d postgres
npm run prisma:generate
npm run prisma:migrate
npm run seed
docker compose up --build api worker web
```

More details:

- [Deployment Guide](./docs/deployment.md)
- [Deployment Diagram](./docs/deployment-diagram.md)

## Environment Variables

| Variable | Description |
| --- | --- |
| `NODE_ENV` | Runtime environment |
| `PORT` | API server port |
| `WEB_ORIGIN` | Allowed frontend origin |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Access token signing secret |
| `JWT_REFRESH_SECRET` | Refresh token signing secret |
| `ACCESS_TOKEN_TTL_MINUTES` | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | Refresh token lifetime |
| `LOG_LEVEL` | Pino logger level |
| `WORKER_POLL_INTERVAL_MS` | Worker poll cadence |
| `WORKER_HEARTBEAT_INTERVAL_MS` | Worker heartbeat cadence |
| `MAX_JOB_CLAIM_BATCH` | Maximum jobs claimed per poll |
| `RECURRING_SCAN_CRON` | Recurring schedule evaluation cron |
| `SOCKET_SNAPSHOT_INTERVAL_MS` | Socket snapshot push cadence |
| `WORKER_NAME` | Worker identity |
| `WORKER_CONCURRENCY` | Worker concurrency limit |
| `WORKER_SHUTDOWN_TIMEOUT_MS` | Graceful shutdown wait budget |

Reference file:

- [`.env.example`](./.env.example)

## API Documentation

The API exposes both machine-readable and UI-driven documentation:

- Swagger UI: `http://localhost:4000/api/docs`
- OpenAPI JSON: `http://localhost:4000/api/openapi.json`
- Extended endpoint guide: [docs/api.md](./docs/api.md)

## Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Authentication model highlights:

- short-lived access tokens
- refresh token rotation
- session persistence
- role-scoped authorization
- protected routes enforced server-side

Detailed flow:

- [Authentication Flow](./docs/authentication-flow.md)

## Queue System

Each queue supports:

- status transitions
- concurrency limits
- max worker policies
- retry policy settings
- optional rate limit per minute
- queue metrics and throughput statistics

Documentation:

- [Queue Flow](./docs/queue-flow.md)

## Worker System

Workers:

- claim jobs atomically with SQL row locking semantics
- emit heartbeats
- requeue claimed jobs during shutdown recovery
- update execution logs and lifecycle state
- respect worker concurrency budgets

Documentation:

- [Worker Flow](./docs/worker-flow.md)

## Retry Policies

Supported strategies:

- fixed delay
- linear backoff
- exponential backoff

Documentation:

- [Retry Flow](./docs/retry-flow.md)

## Dead Letter Queue

When retries are exhausted:

- jobs are marked `DEAD_LETTER`
- a dead-letter row is written for auditability
- operators can retry the job from the dashboard or API

## Scheduler

The control plane runs cron-backed routines for:

- promoting scheduled and retrying jobs when due
- evaluating recurring schedules
- marking stale workers
- recovering abandoned jobs
- pushing Socket.IO metric snapshots

## Dashboard

The web application includes:

- login page
- overview metrics
- queue list and pause/resume controls
- job explorer with retry and cancel actions
- worker status and heartbeat visibility
- real-time invalidation through Socket.IO

## Database Schema

Key entities:

- `User`
- `Organization`
- `OrganizationMember`
- `Project`
- `Queue`
- `RetryPolicy`
- `ScheduledJob`
- `Job`
- `JobExecution`
- `Worker`
- `WorkerHeartbeat`
- `JobLog`
- `DeadLetterQueueEntry`
- `Session`
- `RefreshToken`

Schema references:

- [ER Diagram](./docs/er-diagram.md)
- [Prisma Schema](./prisma/schema.prisma)

## Screenshots

Insert screenshots into:

- [Screenshot Placeholders](./docs/screenshots/README.md)

## System Architecture

- [System Architecture Diagram](./docs/architecture.md)

## ER Diagram

- [ER Diagram](./docs/er-diagram.md)

## Sequence Diagram

- [Sequence Diagram](./docs/sequence-diagram.md)

## Performance

Performance-oriented decisions include:

- Postgres-backed atomic claiming with `FOR UPDATE SKIP LOCKED`
- indexed queue and job filters
- batched pagination queries
- lightweight snapshot broadcasting rather than expensive per-row websocket fanout
- worker-local concurrency controls

## Security

Security measures include:

- password hashing with bcrypt
- JWT verification and refresh rotation
- session invalidation on logout
- route-level RBAC
- CORS and Helmet middleware
- rate limiting on the API
- structured error responses with request ids

## Testing

Current automated verification:

- `npm test`
- `npm run build`

The API test suite currently covers:

- auth helpers
- app wiring
- middleware branches
- route coverage through Supertest
- core job service behavior

Coverage target status:

- API measured coverage exceeds the 80% target for statements, lines, functions, and branches within the configured backend surface.

## Deployment

Local and deployment notes are documented in:

- [Deployment Guide](./docs/deployment.md)
- [Deployment Diagram](./docs/deployment-diagram.md)

## Future Enhancements

- Redis adapter for multi-instance Socket.IO
- worker plugin registry for custom job handlers
- queue sharding and partition-aware scheduling
- webhook and email notifications
- advanced workflow dependency graphs
- distributed locking for multi-controller deployments

## Roadmap

- create and version Prisma migrations
- add end-to-end Docker Compose verification with production-like startup commands
- expand worker and scheduler integration test coverage
- add screenshot artifacts to the documentation set
- support richer queue dashboards and filtering dimensions

## Contributing

Contribution guidance is available in [CONTRIBUTING.md](./CONTRIBUTING.md). In short:

- use small, reviewable changes
- keep TypeScript strict and validated
- run `npm test` and `npm run build` before submitting
- update documentation with behavior changes

## License

This repository is available under the [MIT License](./LICENSE).

## Acknowledgements

- the assignment specification for defining the feature envelope
- Prisma, Express, React, and PostgreSQL communities
- open-source tooling that makes reproducible local environments practical

## GitHub Repository

- Repository: [namanmahajan2020/Distributed-Job-Scheduler](https://github.com/namanmahajan2020/Distributed-Job-Scheduler)
- Student: `Naman Mahajan`
- Registration Number: `RA2311003011711`
