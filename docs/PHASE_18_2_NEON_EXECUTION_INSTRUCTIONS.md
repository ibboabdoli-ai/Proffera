# Phase 18.2 — Neon execution instructions

Status: prepared instructions only.  
Do not execute the migration until the user explicitly confirms in Neon.

## Goal

Run the prepared Booking/CRM MVP schema migration manually in Neon SQL Editor.

Migration file:

```text
db/migrations/20260613_phase18_booking_crm.sql
```

This migration creates new SaaS CRM/booking tables only:

- `customers`
- `bookings`
- `customer_events`

Protected existing tables that must not be changed:

- `quote_requests`
- `company_registrations`
- `lead_outbox`

## Before running

Confirm that you are in the correct Neon project/database for Proffera production or staging.

Recommended pre-check query:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Expected before execution:

- Existing lead-flow tables may already exist.
- `customers`, `bookings`, and `customer_events` should not exist yet, unless the migration has already been run.

## Execution steps

1. Open Neon Dashboard.
2. Open the correct Proffera project.
3. Open SQL Editor.
4. Copy the full SQL from:

```text
db/migrations/20260613_phase18_booking_crm.sql
```

5. Paste it into SQL Editor.
6. Run it once.
7. Save/screenshot the result.

## Post-run verification queries

Run this query:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('customers', 'bookings', 'customer_events')
order by table_name;
```

Expected result:

```text
bookings
customer_events
customers
```

Then verify columns:

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('customers', 'bookings', 'customer_events')
order by table_name, ordinal_position;
```

Then verify that existing lead-flow tables still exist:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('quote_requests', 'company_registrations', 'lead_outbox')
order by table_name;
```

## Rollback policy

Do not run destructive rollback SQL automatically.

If rollback is required, stop and review manually before deleting tables. The prepared migration only creates new tables, so rollback would normally mean removing the new Phase 18 tables after confirming that no production data needs to be preserved.

## Next phase after success

After the migration is confirmed in Neon, proceed to:

```text
Phase 18.3 — Read-only dashboard database wiring
```

That phase should connect dashboard views to database read queries without adding create/update flows yet.
