# Proffera database migrations

`db/migrations/` is the single canonical source for the active Proffera schema migration history.

## Rules

- Add all new schema migrations to this directory.
- Keep migrations ordered by their date/sequence prefix.
- Do not create new migrations under repository-root `migrations/` or `database/migrations/`.
- Test schema-changing migrations on an isolated Neon branch before Production execution.
- Record Production execution separately from source merge; a merged SQL file is not proof that Production has been migrated.
- Keep pre-Workspace or retired migrations under `db/legacy-migrations/` for audit/history only. They are not part of the active migration chain.

The split historical files that previously lived in `database/migrations/` and `migrations/` were consolidated here on 2026-08-08 without changing their SQL semantics.
