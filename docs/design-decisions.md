# Design Decisions

## Why Postgres-Backed Claiming

Using `FOR UPDATE SKIP LOCKED` keeps correctness centered in the database and avoids duplicate execution when multiple workers compete for the same queue.

## Why Separate API and Worker

The API owns control-plane concerns such as authentication, scheduling, and operator workflows. Workers stay small, stateless, and horizontally scalable.

## Tradeoffs

- Keeping the scheduler loop in the API reduces moving parts, but a dedicated scheduler service would be cleaner at larger scale.
- Realtime currently broadcasts directly from the API. For multi-instance Socket.IO, add Redis or another adapter.
- Demo bootstrap endpoints improve local usability but should be disabled outside non-production environments.
