# P22J — Migration preflight checklist

Status: planned  
Date: 2026-06-16  
Type: migration preflight / execution readiness  
Risk level: high if execution is approved later  
Runtime impact in this phase: none  
Database changes in this phase: none  
Migration execution in this phase: none  

## Purpose

Prepare the final safety checklist before executing the existing database migration candidates.

This phase does not execute SQL and does not change the database.

The goal is to make sure the team has a clear, repeatable, rollback-aware path before any production database migration is approved.

## Completed prerequisites

- P22D completed — Better Auth package foundation.
- P22E completed — Better Auth core schema migration candidate.
- P22F completed — Workspace schema plan.
- P22G completed — Proffera workspace schema migration candidate.
- P22H completed — Migration execution plan.
- P22I completed — Neon read-only inspection.
- P22I confirmed no target table conflicts.
- `.env*`, `.vercel`, and `node_modules` are ignored by Git.

## Migration candidates

The migration files prepared for future execution are:

1. `db/migrations/20260616_0001_better_auth_core_schema.sql`
2. `db/migrations/20260616_0002_proffera_workspace_schema.sql`

## Existing production tables observed in P22I

The production database currently contains:

- `bookings`
- `company_registrations`
- `customer_events`
- `customers`
- `lead_outbox`
- `quote_requests`
- `workspace_services`
- `workspace_settings`

## Target tables not currently present

P22I confirmed that these target tables do not currently exist:

- `user`
- `session`
- `account`
- `verification`
- `workspaces`
- `workspace_memberships`
- `workspace_plans`
- `workspace_feature_flags`

## Required safety checks before any execution

Before any production migration execution, all of the following must be confirmed:

- [ ] Confirm exact database target.
- [ ] Confirm the Neon project and branch.
- [ ] Confirm whether the target is production or non-production.
- [ ] Confirm backup or restore point.
- [ ] Confirm who can restore the database if needed.
- [ ] Confirm that no one else is modifying schema at the same time.
- [ ] Confirm migration files are reviewed and merged in `main`.
- [ ] Confirm local `main` is clean and up to date.
- [ ] Confirm production site is healthy before execution.
- [ ] Confirm no deploy is required for this migration-only step.
- [ ] Confirm migration execution is explicitly approved in a separate step.

## Recommended execution order

If execution is approved later, execute in this order:

1. Better Auth core schema:
   - `db/migrations/20260616_0001_better_auth_core_schema.sql`

2. Proffera workspace schema:
   - `db/migrations/20260616_0002_proffera_workspace_schema.sql`

Reason:

- Better Auth user/session/account/verification tables are foundational.
- Workspace tables depend conceptually on user ownership and membership.
- Auth must exist before workspace membership can be connected to real users.

## Verification after execution

After execution, verify that these tables exist:

- `user`
- `session`
- `account`
- `verification`
- `workspaces`
- `workspace_memberships`
- `workspace_plans`
- `workspace_feature_flags`

Also verify indexes and constraints for:

- Better Auth session/user/account lookup.
- Workspace slug uniqueness.
- Workspace membership uniqueness.
- Workspace plan uniqueness.
- Workspace feature flag uniqueness.

## Explicit non-goals for P22J

P22J must not:

- Execute production SQL automatically.
- Add auth routes.
- Change dashboard access.
- Remove Basic Auth.
- Change runtime application code.
- Migrate customer, booking, quote, or lead data.
- Connect real users to workspaces.
- Deploy manually.

## Rollback strategy

If a later migration execution is approved and fails before commit:

- Stop immediately.
- Do not continue with the second migration.
- Capture the exact error.
- Verify whether any transaction was committed.
- Use Neon restore/branch recovery if committed changes need rollback.
- Do not patch production manually without a new plan.

If migration execution succeeds but later application code fails:

- Keep Basic Auth active.
- Do not expose real login publicly.
- Roll forward with a controlled auth route fix.
- Do not delete newly created auth/workspace tables unless a rollback plan is explicitly approved.

## Decision gate

Production migration execution requires a separate approval after this checklist is reviewed.

Approval phrase should be explicit, for example:

"Execute P22K production migration."

Without that explicit approval, the next phase must remain planning or dry-run only.

## Next phase

Recommended next phase:

P22K — controlled migration execution preparation.

P22K should prepare the exact execution commands and verification script, but still must not execute production SQL until explicitly approved.
