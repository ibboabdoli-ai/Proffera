# P22E — Auth Schema Migration Plan

Status: Planned
Date: 2026-06-15

## Goal

Prepare the database migration strategy for Proffera authentication after P22D added the Better Auth foundation dependencies.

This phase is documentation and planning only. It must not apply database migrations, create auth routes, or change runtime login/dashboard behavior.

## Current baseline

- Better Auth dependencies are present with exact versions.
- `src/lib/auth.ts` exposes a lazy `getAuth()` helper.
- No Better Auth route has been added yet.
- No auth database tables have been created by this project yet.
- `/dashboard` is still protected by temporary Basic Auth middleware.

## Migration scope for the next implementation phase

The next implementation phase should add a reversible SQL migration that creates only the authentication tables required for Better Auth.

The migration must not modify existing Proffera business tables such as customers, bookings, services, leads, or workspace settings.

## Table ownership principle

Better Auth should own the core identity/session tables.

Proffera should own all product authorization and business tables, including:

- workspaces
- workspace memberships
- roles and permissions
- plan/subscription state
- CRM data
- booking data
- service configuration
- AI feature access

## Expected Better Auth table group

The implementation phase should verify Better Auth’s current PostgreSQL schema requirements before writing SQL, but the expected table group is:

- user/account identity table
- session table
- account/provider table
- verification token table

Column names and indexes must be taken from the exact Better Auth version used in the project, not guessed.

## Migration safety rules

- Use a new migration file.
- Make the migration additive only.
- Do not drop or rename existing tables.
- Do not change existing dashboard queries.
- Do not connect `/logga-in` to real auth yet.
- Do not remove Basic Auth yet.
- Include a clear rollback/down section if the project migration format supports it.
- Keep schema names explicit and avoid collisions with existing business tables.

## Required verification before merge

The implementation PR must verify:

- `npm install --no-package-lock`
- `npm run lint`
- `npm run build`
- migration SQL review
- no dashboard behavior change
- no customer/booking table changes

## Recommended next implementation step

P22E-implementation should add the auth schema migration only. It should not add routes, login UI wiring, sessions, workspace membership logic, or dashboard authorization changes.

After that, P22F should add Proffera-owned workspace/membership schema.
