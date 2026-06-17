# P22J-E — Migration runner template draft

Status: planned  
Date: 2026-06-17  
Type: guarded template only  
Database changes: none  
Migration execution: none  
Runtime changes: none  

## Purpose

This phase adds a non-executable production migration runner template.

The template documents the intended migration order and future approval gates.

P22J-E does not create a real migration runner.

## Added file

`scripts/p22k-run-production-migration.template.cjs`

## Safety model

The template is intentionally inert.

It must:

- Refuse to run.
- Not connect to the database.
- Not read `DATABASE_URL`.
- Not execute SQL.
- Not run migration files.
- Not modify production data.

## Future real runner requirements

A future real runner may only be created in a later approved P22K phase.

It must require:

- Clean `main`.
- Confirmed production database target.
- Confirmed backup or restore point.
- Repeated read-only conflict check.
- Explicit approval phrase.
- Explicit execution flag.
- Exact confirmation environment variable.
- Transactional execution.
- Rollback on error.

## Required future approval phrase

`Execute P22K production migration.`

Without this phrase, no migration execution is allowed.

## Future migration order

1. `db/migrations/20260616_0001_better_auth_core_schema.sql`
2. `db/migrations/20260616_0002_proffera_workspace_schema.sql`

## Explicit non-goals for P22J-E

P22J-E must not:

- Execute SQL.
- Connect to Neon.
- Read `DATABASE_URL`.
- Run migration files.
- Create database tables.
- Modify production data.
- Add auth routes.
- Change dashboard access.
- Remove Basic Auth.
- Deploy manually.

## Next phase

Recommended next phase:

P22J-F — Migration runner template review.

P22J-F should verify that the template is inert and safe before any later P22K execution work.
