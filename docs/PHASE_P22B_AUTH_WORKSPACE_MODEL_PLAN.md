# P22B — Auth and workspace model plan

Status: plan only.

Date: 2026-06-15

## Goal

Define the safe path from temporary dashboard protection to real Proffera customer authentication, workspace access and tenant isolation.

This phase does not implement auth and does not change the database.

## Current state

- `/logga-in` exists as a Proffera-owned customer portal entry page.
- `/dashboard` and `/dashboard/*` have temporary Basic Auth protection.
- Dashboard data still uses `workspace_id = 'default'`.
- Customers, bookings, customer events, workspace settings and workspace services work for the controlled MVP workspace.
- Proffera does not currently have an auth library or auth tables.

## Problem to solve

Before real customers use the product, Proffera needs:

- real users
- secure sessions
- workspaces/companies
- workspace memberships
- roles and permissions
- workspace-derived data access
- a replacement for `workspace_id = 'default'`

## Recommended product model

### User

A person who can log in to Proffera.

Minimum fields:

- id
- email
- name
- status
- created_at
- updated_at

### Workspace

A customer company/account inside Proffera.

Minimum fields:

- id
- slug
- company_name
- primary_city
- plan
- status
- created_at
- updated_at

### Workspace membership

Connects a user to a workspace.

Minimum fields:

- id
- workspace_id
- user_id
- role
- created_at
- updated_at

Initial roles:

- owner
- admin
- member

### Session

A trusted logged-in browser session.

Implementation should be decided before code starts.

## Authorization rules

- A user can only access `/dashboard` if they have an active session.
- A user can only read/write data for workspaces where they have an active membership.
- Dashboard queries must derive `workspace_id` from the session and membership, not from query params or hidden form fields.
- Dashboard writes must validate both input and workspace permission server-side.
- Admin routes must remain separate from customer dashboard routes.

## Migration principles

When implementation starts, database changes must be additive first.

Do not destructively change existing tables.

Safe first migration should add new tables only:

- `app_users` or provider-owned user mapping table
- `workspaces`
- `workspace_memberships`

After that, existing MVP tables can be migrated gradually from text `workspace_id = 'default'` to real workspace IDs.

## Implementation sequence

### P22C — Choose auth implementation

Compare and choose the actual auth approach before code:

- Managed auth provider
- Auth.js-compatible setup
- Custom magic-link/session model

Decision must consider:

- Next.js App Router compatibility
- Neon/Postgres compatibility
- Swedish/EU data expectations
- cost
- implementation risk
- long-term maintainability

### P22D — Add auth schema migration

Create additive migration only.

Do not modify existing CRM/booking rows yet.

Wait for Neon execution and SQL verification before code depends on the tables.

### P22E — Implement login/session skeleton

Replace `/logga-in` placeholder with real login start.

Protect `/dashboard` through session, not Basic Auth.

Keep Basic Auth fallback until real login is verified.

### P22F — Bind dashboard to workspace

Read the active workspace from session membership.

Only after this, begin replacing `workspace_id = 'default'` in dashboard reads/writes.

## Non-goals

Do not do these in P22B:

- no auth dependency install
- no database migration
- no real login
- no password handling
- no Stripe
- no email sending
- no Service AI Chat merge
- no destructive data migration
- no dashboard write expansion

## Verification for this planning phase

- Confirmed current `package.json` has no auth dependency.
- Confirmed middleware uses temporary dashboard Basic Auth.
- Confirmed master plan requires session-derived workspace identity before real onboarding.

## Next safe step

P22C: choose the auth implementation approach before writing code or migrations.
