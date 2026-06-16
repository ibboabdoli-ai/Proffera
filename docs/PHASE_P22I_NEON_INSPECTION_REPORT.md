# P22I — Neon read-only inspection report

Status: completed  
Date: 2026-06-16  
Type: database inspection report  
Risk level: low  
Runtime impact: none  
Migration execution: none  

## Goal

Inspect the current Neon database in read-only mode before executing any auth or workspace migrations.

This phase did not execute migrations and did not change production data.

## Safety mode

The inspection was run with:

- `BEGIN READ ONLY`
- `SET LOCAL statement_timeout = '10s'`
- Read-only SELECT queries only
- No INSERT
- No UPDATE
- No DELETE
- No ALTER
- No DROP
- No CREATE
- No migration file execution

## Database inspected

Observed database information:

- Database name: `neondb`
- Schema: `public`
- Current user: `neondb_owner`

## Existing public tables

The following public tables currently exist:

- `bookings`
- `company_registrations`
- `customer_events`
- `customers`
- `lead_outbox`
- `quote_requests`
- `workspace_services`
- `workspace_settings`

## Migration target table conflict check

Checked target tables:

- `user`
- `session`
- `account`
- `verification`
- `workspaces`
- `workspace_memberships`
- `workspace_plans`
- `workspace_feature_flags`

Result:

- No target table conflicts found.

## Existing public indexes observed

Existing indexes were observed on current production tables, including:

- `bookings`
- `company_registrations`
- `customer_events`
- `customers`
- `lead_outbox`
- `quote_requests`
- `workspace_services`
- `workspace_settings`

No auth or workspace migration target indexes exist yet.

## Conclusion

P22I confirms that the current production database does not already contain the target Better Auth or Proffera workspace tables.

The existing migration candidates can be considered for a controlled execution step later, but no migration has been executed yet.

## Next recommended phase

P22J — Migration execution dry-run / final pre-production decision.

P22J must still avoid automatic production execution until explicitly approved.

Before any production execution:

1. Confirm backup or restore strategy.
2. Confirm exact database target.
3. Prefer non-production execution first if available.
4. Execute Better Auth schema first.
5. Execute Proffera workspace schema second.
6. Verify tables and indexes after execution.
7. Keep dashboard Basic Auth until real auth is fully verified.
