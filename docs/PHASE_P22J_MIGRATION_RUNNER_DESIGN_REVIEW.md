# P22J-C — Migration runner design review

Status: planned  
Date: 2026-06-17  
Type: documentation only  
Database changes: none  
Migration execution: none  
Runtime changes: none  

## Purpose

This document defines the required design for a future local migration runner.

P22J-C does not create the runner file, does not execute SQL, does not run migration files, and does not modify the database.

## Background

The project already has two migration candidates:

1. `db/migrations/20260616_0001_better_auth_core_schema.sql`
2. `db/migrations/20260616_0002_proffera_workspace_schema.sql`

P22I confirmed that the target auth/workspace tables do not currently exist.

P22J-A and P22J-B documented preflight and execution-command rules.

## Required approval rule

A real migration runner must not be executed unless a later P22K phase is explicitly approved.

Required approval phrase:

`Execute P22K production migration.`

Without this phrase, no migration execution is allowed.

## Runner design requirements

The future runner must:

- Read `DATABASE_URL` from local environment only.
- Never print `DATABASE_URL`.
- Refuse to run if `DATABASE_URL` is missing.
- Connect using `pg`.
- Start a transaction.
- Set `statement_timeout`.
- Execute Better Auth migration first.
- Execute workspace migration second.
- Commit only if both migrations succeed.
- Roll back on any error.
- Print a clear success/failure summary.
- Exit with non-zero status on failure.

## Required safety behavior

The future runner must not:

- Accept database URL as a command-line argument.
- Write secrets to files.
- Commit generated files.
- Execute destructive SQL outside the approved migration files.
- Continue after a failed first migration.
- Hide migration errors.
- Deploy the application.

## Required pre-run checks

Before the runner is executed in a later phase:

- Local branch must be `main`.
- `main` must be up to date with `origin/main`.
- Working tree must be clean.
- Backup or restore point must be confirmed.
- Neon project and branch must be confirmed.
- Production site health must be checked.
- Read-only conflict check must be repeated.

## Required post-run verification

After a later approved execution, verify that these tables exist:

- `user`
- `session`
- `account`
- `verification`
- `workspaces`
- `workspace_memberships`
- `workspace_plans`
- `workspace_feature_flags`

Also verify relevant indexes and uniqueness constraints.

## Non-goals for P22J-C

P22J-C must not:

- Add a runner script.
- Execute SQL.
- Run migrations.
- Create database tables.
- Modify production data.
- Add auth routes.
- Change dashboard access.
- Remove Basic Auth.
- Deploy manually.

## Next phase

Recommended next phase:

P22J-D — Migration runner draft file preparation.

P22J-D may add a local-safe runner script template, but execution still requires explicit P22K approval.
