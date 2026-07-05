# Contributing

## Development Workflow

1. Install dependencies with `npm install`.
2. Generate Prisma client with `npm run prisma:generate`.
3. Start PostgreSQL locally or through Docker Compose.
4. Run `npm run prisma:migrate` and `npm run seed`.
5. Use `npm run dev:api`, `npm run dev:worker`, and `npm run dev:web` while developing.

## Pull Request Expectations

- keep changes focused
- add or update tests when behavior changes
- run `npm test` and `npm run build`
- update README or docs for user-facing changes
- preserve working functionality

## Code Standards

- TypeScript first
- explicit validation with Zod
- structured logging
- production-safe defaults
- no unchecked database writes
