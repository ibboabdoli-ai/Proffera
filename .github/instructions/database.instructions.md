---
applyTo: "db/migrations/**,src/lib/db/**,tests/**/*.integration.test.ts,tests/**/*.integration.test.tsx"
---

# Database and integration-test worker instructions

Use these rules together with `AGENTS.md` and `WORKER_BOOTSTRAP.md` for Neon/PostgreSQL schema, migration, SQL, locking and integration-test work.

## Source of truth

- Canonical migrations define Production schema evolution. Do not reproduce Production table DDL manually inside tests when a migration can create the required contract.
- Prefer shared migration/application helpers and reusable seed fixtures over task-specific schema copies.
- Create only the minimal dependency schema that is genuinely outside the canonical migration path.
- Do not infer Production schema state from ORM/types/tests alone; verify the canonical migration/schema-health source relevant to the task.

## Migration discipline

- Default to additive, forward-compatible migrations.
- Destructive or data-rewriting changes require explicit authorization, rollback/repair thinking and isolated proof before Production.
- Make migration application idempotence/ledger behavior explicit where the repository migration system requires it.
- Keep constraints, indexes, foreign keys, predicates and validation state aligned with runtime assumptions.

## Concurrency and transactions

- If correctness depends on uniqueness, locking, selection order or one-time state transition, test the real PostgreSQL behavior.
- Identify the transaction boundary and lock ordering before adding concurrency fixes.
- Avoid check-then-write races when the database can enforce the invariant atomically.
- Treat retry behavior as part of the transaction design: a retried request must not duplicate externally visible state.

## Integration-test realism

- PostgreSQL-backed tests should apply the canonical relevant migrations rather than hand-copying the tables under test.
- Reuse a canonical test database/harness when available; extend it instead of introducing a second setup path.
- Expensive Docker/PostgreSQL suites must remain explicit opt-in according to the repository integration-test flag/convention and must not unexpectedly run in the normal unit suite.
- Tests must clean up disposable resources and use bounded timeouts so a failed lock/barrier cannot hang CI indefinitely.
- Use deterministic barriers for concurrency tests instead of sleep-based timing when practical.

## Environment safety

- Never run destructive or uncertain integration tests against Production or a shared customer database.
- Use an isolated non-Production Neon branch/disposable PostgreSQL instance for mutation proof.
- Do not log database credentials, connection strings containing secrets, customer rows or private Production payloads.
