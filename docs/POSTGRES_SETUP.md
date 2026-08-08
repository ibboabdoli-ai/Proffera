# PostgreSQL / Neon setup

## Current source of truth

Proffera uses PostgreSQL on Neon. The active schema migration history lives only in:

- `db/migrations/`

Read `db/migrations/README.md` before adding or executing schema changes.

## Runtime database configuration

Production uses a PostgreSQL connection string configured in the deployment environment. Preview must use its isolated Preview database URL and must never fall back to Production merely to make a Preview build work.

## Migration workflow

1. Add the new migration under `db/migrations/` with an ordered date/sequence prefix.
2. Inspect current Production schema/data read-only.
3. Test the exact migration against an isolated Neon branch cloned from Production.
4. Run application CI and relevant regression tests.
5. Execute the approved migration against Production through the controlled migration workflow.
6. Verify the resulting schema and the affected user flow after execution.

Merging a migration file into Git is not proof that Production has been migrated. Production execution and verification must be recorded separately.

## Historical migration

The original `quote_requests` migration predates the current Workspace architecture. It is preserved only for audit/history under:

- `db/legacy-migrations/001_create_quote_requests.sql`

It is not part of the active migration chain and must not be replayed as part of a current Proffera deployment.
