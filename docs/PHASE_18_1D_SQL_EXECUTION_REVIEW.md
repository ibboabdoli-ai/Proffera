# Phase 18.1D — Final SQL execution review

Status: reviewed, not executed.

## Migration under review

- `db/migrations/20260613_phase18_booking_crm.sql`

## Summary

The migration is prepared for a first Booking/CRM MVP schema. It creates new tables for customers, bookings, and customer events. It does not alter existing lead-flow tables.

## Protected existing flows

The following existing tables and flows must not be changed by this migration:

- `quote_requests`
- `company_registrations`
- `lead_outbox`
- existing admin routes
- existing Brevo/outbox flow
- existing company matching logic

## Review result

- Creates only new tables.
- Uses `CREATE TABLE IF NOT EXISTS`.
- Uses `CREATE INDEX IF NOT EXISTS`.
- Uses `BEGIN` and `COMMIT`.
- Keeps service taxonomy as soft references through slug fields.
- Does not create taxonomy management tables yet.
- Does not seed data.
- Does not connect dashboard pages to the database yet.

## Tables created

- `customers`
- `bookings`
- `customer_events`

## Soft taxonomy fields

The migration includes fields that can later connect records to `src/lib/service-taxonomy.ts`:

- `customers.primary_service_category_slug`
- `customers.primary_service_slug`
- `bookings.service_category_slug`
- `bookings.service_slug`

These are text fields for now. There are no foreign keys to taxonomy tables yet.

## Known limitations accepted for MVP

- `updated_at` exists but has no automatic trigger yet.
- `workspace_id` is text with default `default`, not a final tenant model.
- No user authentication or dashboard database connection is included in this migration.
- No booking confirmation emails are included in this migration.

## Execution recommendation

Do not run automatically from code or deployment.

Run manually in Neon only after confirming:

1. Production database backup/export is available or Neon restore point is confirmed.
2. The SQL file is copied exactly from `db/migrations/20260613_phase18_booking_crm.sql`.
3. The SQL is run once in Neon SQL Editor.
4. After execution, verify tables exist before building dashboard read-only views.

## Post-run verification queries

Use these checks after manual execution:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('customers', 'bookings', 'customer_events')
order by table_name;
```

```sql
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename in ('customers', 'bookings', 'customer_events')
order by tablename, indexname;
```

## Decision

Ready for manual execution review, but not executed yet.
