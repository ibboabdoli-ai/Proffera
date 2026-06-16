# P22H — Migration execution plan

Status: planned
Date: 2026-06-16
Type: documentation only
Risk level: low
Runtime impact: none

## Goal

Prepare a safe execution plan for applying the database migration files that already exist in the repository.

This phase does not execute migrations.

## Migration files in scope

1. `db/migrations/20260616_0001_better_auth_core_schema.sql`
   - Better Auth core identity/session schema
   - Tables: `user`, `session`, `account`, `verification`

2. `db/migrations/20260616_0002_proffera_workspace_schema.sql`
   - Proffera-owned workspace schema
   - Tables: `workspaces`, `workspace_memberships`, `workspace_plans`, `workspace_feature_flags`

## Strict non-goals

Do not:

- Execute SQL against Neon
- Change production data
- Add auth routes
- Enable real login
- Remove dashboard Basic Auth
- Change dashboard queries
- Migrate CRM, booking, customer, or lead data
- Connect users to dashboard access
- Change Service AI Chat integration

## Safety checklist before execution

Before any SQL is applied to Neon:

1. Confirm the exact production database target.
2. Confirm latest backup or restore point.
3. List existing public tables.
4. Check whether target table names already exist.
5. Confirm migration order:
   - Better Auth core schema first
   - Proffera workspace schema second
6. Run migrations first on a non-production database if available.
7. Verify tables, indexes, constraints, and foreign keys.
8. Only then consider production execution.

## Read-only checks to run before execution

List existing tables:

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

Check target table conflicts:

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'user',
    'session',
    'account',
    'verification',
    'workspaces',
    'workspace_memberships',
    'workspace_plans',
    'workspace_feature_flags'
  )
ORDER BY table_name;

Verify created tables after execution:

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'user',
    'session',
    'account',
    'verification',
    'workspaces',
    'workspace_memberships',
    'workspace_plans',
    'workspace_feature_flags'
  )
ORDER BY table_name;

Verify indexes after execution:

SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'user',
    'session',
    'account',
    'verification',
    'workspaces',
    'workspace_memberships',
    'workspace_plans',
    'workspace_feature_flags'
  )
ORDER BY tablename, indexname;

## Rollback strategy

Because the migration files are additive and create new tables only, rollback before production data is written would be:

1. Confirm the auth/workspace tables are empty.
2. Drop dependent workspace tables first.
3. Drop Better Auth tables second.

Rollback must not be run without explicit approval.

## Acceptance criteria

P22H is complete when:

- This execution plan is committed.
- No SQL has been executed.
- No runtime code has changed.
- Build still passes.
- Vercel remains green.
