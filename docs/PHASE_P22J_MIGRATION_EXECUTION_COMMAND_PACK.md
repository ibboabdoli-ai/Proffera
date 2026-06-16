# P22J-B — Migration execution command pack

Status: planned  
Date: 2026-06-16  
Type: documentation only  
Database changes: none  
Migration execution: none  
Runtime changes: none  

## Purpose

This document prepares the command plan and safety rules for a later controlled migration phase.

P22J-B does not execute SQL, does not run migration files, and does not modify the database.

## Migration files

Prepared migration candidates:

1. `db/migrations/20260616_0001_better_auth_core_schema.sql`
2. `db/migrations/20260616_0002_proffera_workspace_schema.sql`

Required future execution order:

1. Better Auth core schema
2. Proffera workspace schema

## Required explicit approval

Real migration execution must only happen in a later phase with explicit approval.

Required approval phrase:

`Execute P22K production migration.`

Without this phrase, no migration must be executed.

## Pre-execution checklist

Before any future migration execution:

- Local branch must be `main`.
- `main` must be up to date with `origin/main`.
- Working tree must be clean.
- Exact Neon project must be confirmed.
- Exact Neon branch must be confirmed.
- Exact database name must be confirmed.
- Production vs non-production target must be confirmed.
- Backup or restore point must be confirmed.
- Restore owner must be confirmed.
- No other schema work must be running at the same time.
- Production site health must be confirmed.
- Migration execution must be approved in a separate phase.

## DATABASE_URL rule

`DATABASE_URL` must never be pasted into chat.

`DATABASE_URL` must never be committed to Git.

If migration execution is approved later, `DATABASE_URL` must only be set locally in the terminal.

## Future read-only verification

Before future execution, run another read-only database check.

The check must verify:

- Current public tables.
- Whether target auth/workspace tables already exist.
- No mutating SQL.
- No migration execution.

## Future runner requirements

The future migration runner must:

- Connect using `DATABASE_URL`.
- Start a transaction.
- Set a statement timeout.
- Execute Better Auth migration first.
- Execute workspace migration second.
- Commit only if both migrations succeed.
- Roll back on any error.
- Never print `DATABASE_URL`.

## Future post-execution verification

After an approved execution, verify that these tables exist:

- `user`
- `session`
- `account`
- `verification`
- `workspaces`
- `workspace_memberships`
- `workspace_plans`
- `workspace_feature_flags`

## Explicit non-goals for P22J-B

P22J-B must not:

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

P22J-C — Migration runner design review.

Real execution still requires explicit P22K approval.
