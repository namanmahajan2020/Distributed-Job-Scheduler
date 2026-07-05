# Deployment Guide

## Local

1. Create `.env` from `.env.example`.
2. Run `npm install`.
3. Generate Prisma client with `npm run prisma:generate`.
4. Apply migrations with `npm run prisma:migrate`.
5. Seed sample data with `npm run seed`.
6. Start stack with `docker compose up --build`.

## Production Notes

- Run API and worker as separate deployments so workers scale independently.
- Put Postgres behind managed backups and point-in-time recovery.
- Terminate TLS at an ingress or load balancer.
- Route Socket.IO through sticky sessions or a pub/sub adapter when horizontally scaling the API.
- Move secrets to a vault or platform secret manager.
