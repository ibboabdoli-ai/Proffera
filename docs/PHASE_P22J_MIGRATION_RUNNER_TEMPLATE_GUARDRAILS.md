# P22J-D — Migration runner template guardrails

Status: planned  
Date: 2026-06-17  
Type: documentation only  
Database changes: none  
Migration execution: none  
Runtime changes: none  

## Purpose

This document defines the guardrails for a future migration runner template.

P22J-D does not add a runnable migration script.

P22J-D does not execute SQL, does not run migrations, and does not modify the database.

## Reason for not adding a runner yet

A runnable migration script can be operationally risky, even if it is not executed immediately.

Before adding a real runner file, the project must first define strict safety gates.

## Future runner file location

If approved in a later phase, the runner should be placed under:

`scripts/p22k-run-production-migration.cjs`

The file must not be added until the project is ready for a controlled execution phase.

## Required execution gates

A future runner must require all of these gates:

- `DATABASE_URL` must be set in the local terminal.
- `DATABASE_URL` must never be printed.
- The runner must refuse to run unless an explicit execution flag is provided.
- The runner must refuse to run unless an explicit confirmation environment variable is set.
- The runner must print the migration files it is about to execute.
- The runner must require a final manual confirmation prompt.
- The runner must run both migrations inside one transaction.
- The runner must roll back on any error.
- The runner must exit with non-zero status on failure.

## Suggested future execution flag

The future runner should require this flag:

`--execute-p22k-production-migration`

Without this flag, the runner must exit before connecting to the database.

## Suggested future confirmation environment variable

The future runner should require this environment variable:

`P22K_CONFIRM_PRODUCTION_MIGRATION=Execute P22K production migration`

Without this exact value, the runner must exit before connecting to the database.

## Required migration order

The future runner must execute migrations in this order:

1. `db/migrations/20260616_0001_better_auth_core_schema.sql`
2. `db/migrations/20260616_0002_proffera_workspace_schema.sql`

## Required pre-run checks

Before the future runner is executed:

- Local branch must be `main`.
- `main` must be up to date with `origin/main`.
- Working tree must be clean.
- Backup or restore point must be confirmed.
- Production database target must be confirmed.
- Read-only conflict check must be repeated.
- Production site health must be checked.
- P22K execution must be explicitly approved.

## Required post-run checks

After a later approved execution, verify that these tables exist:

- `user`
- `session`
- `account`
- `verification`
- `workspaces`
- `workspace_memberships`
- `workspace_plans`
- `workspace_feature_flags`

## Explicit non-goals for P22J-D

P22J-D must not:

- Add a runnable migration script.
- Execute SQL.
- Run migration files.
- Create database tables.
- Modify production data.
- Add auth routes.
- Change dashboard access.
- Remove Basic Auth.
- Deploy manually.

## Next phase

Recommended next phase:

P22J-E — Migration runner template draft.

P22J-E may add a guarded runner template file, but execution must still require explicit P22K approval.
