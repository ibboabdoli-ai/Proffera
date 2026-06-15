# P22C — Auth implementation decision

Status: completed decision.

Date: 2026-06-15

## Goal

Choose the real authentication direction before writing auth code, installing dependencies or creating database migrations.

## Decision

Use **Better Auth with PostgreSQL/Neon** as the planned authentication foundation for Proffera.

Use Better Auth for:

- user authentication
- session management
- account/session tables
- future auth-related capabilities such as email/password, organization/access-control plugins if needed

Keep Proffera-owned application tables for:

- workspaces
- workspace memberships
- Proffera roles
- plan/subscription state
- CRM/booking/business data access

## Why this fits Proffera

- Proffera already uses Next.js, TypeScript and Neon/Postgres.
- Better Auth is TypeScript-native and framework-agnostic.
- Better Auth supports account/session management and access-control features.
- Better Auth supports PostgreSQL integration.
- Keeping workspaces in Proffera avoids locking core business data to a third-party organization model.
- This path keeps the customer journey inside Proffera.

## Options considered

### Better Auth + PostgreSQL/Neon

Selected.

Pros:

- Fits the current TypeScript/Next/Postgres stack.
- Keeps auth implementation inside the codebase.
- Supports PostgreSQL.
- Has built-in account/session management and organization/access-control capabilities.
- Lower vendor lock-in than a fully managed identity provider.

Cons:

- More engineering work than a fully managed auth provider.
- Requires careful schema, migration and email configuration.
- Requires security review before real customer onboarding.

### Clerk

Not selected for this phase.

Pros:

- Fastest B2B auth route.
- Strong Next.js support.
- Built-in organizations, memberships, roles and permissions.

Cons:

- Adds an external managed identity vendor.
- Organization/customer context would partly live outside Proffera.
- Pricing, data-location and vendor dependency should be reviewed before committing.

### Supabase Auth

Not selected.

Pros:

- Mature auth product.
- Supports Next.js SSR patterns.

Cons:

- Proffera currently uses Neon/Postgres and does not use Supabase as the main stack.
- Would introduce another platform and auth/database client model.
- Project decisions currently say not to describe Supabase as the current main stack.

### Custom auth from scratch

Not selected.

Pros:

- Maximum control.

Cons:

- Highest security risk.
- Slower to build correctly.
- Requires password/magic-link/session/token hardening that should not be reinvented at this stage.

## Planned implementation sequence

### P22D — Add auth dependencies and minimal config

- Add Better Auth dependencies only after approval.
- Create config using existing Neon/Postgres connection.
- Do not protect production dashboard through Better Auth until the login flow is tested.
- Keep temporary dashboard Basic Auth as fallback during transition.

### P22E — Add auth schema migration

- Create additive migration only.
- Prefer a separate auth schema/table namespace if practical.
- Wait for Neon execution and SQL verification before app code depends on the tables.

### P22F — Add Proffera workspace schema

Add additive tables:

- `workspaces`
- `workspace_memberships`

Do not yet rewrite existing CRM/booking rows.

### P22G — Real login skeleton

- Replace `/logga-in` placeholder with real sign-in/sign-out flow.
- Keep Swedish UX.
- Keep dashboard Basic Auth fallback until the real flow is verified.

### P22H — Session-derived dashboard workspace

- Resolve active workspace from authenticated session and membership.
- Replace hardcoded `workspace_id = 'default'` gradually.
- Each dashboard read/write must verify workspace membership server-side.

## Non-goals

Do not do these in P22C:

- no dependency install
- no auth routes
- no database migration
- no changes to dashboard queries
- no removal of temporary Basic Auth
- no Stripe
- no Service AI Chat merge
- no destructive data migration

## Verification

- Current `package.json` has no auth dependency.
- Current project stack is Next.js, TypeScript, Neon/Postgres and Zod.
- Better Auth and Clerk official docs were checked before this decision.

## Next safe step

P22D: add Better Auth dependency/config only, in a small reversible patch, after approval.
