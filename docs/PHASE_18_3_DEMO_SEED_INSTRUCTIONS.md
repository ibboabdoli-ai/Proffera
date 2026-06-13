# Phase 18.3 — Demo CRM/booking seed instructions

Status: prepared, not executed by code.

## Goal

Seed a very small safe demo dataset into the Phase 18 CRM/booking tables so the upcoming dashboard read-only DB views can be tested against real database rows.

The seed creates:

- 1 demo customer
- 1 demo booking
- 1 demo customer event

## Files

Seed SQL:

```text
db/seeds/20260613_phase18_demo_crm_booking.sql
```

Rollback SQL:

```text
db/seeds/20260613_phase18_demo_crm_booking_rollback.sql
```

## Safety

The seed is intentionally limited and uses fixed UUIDs:

```text
11111111-1111-4111-8111-111111111111 — customer
22222222-2222-4222-8222-222222222222 — booking
33333333-3333-4333-8333-333333333333 — customer_event
```

Repeated execution should update the same demo records through `ON CONFLICT (id) DO UPDATE` rather than creating duplicates.

The seed does not touch existing lead-flow tables:

- `quote_requests`
- `company_registrations`
- `lead_outbox`

## Execution steps in Neon

1. Open Neon Dashboard.
2. Open the Proffera project.
3. Open SQL Editor.
4. Paste the full content of:

```text
db/seeds/20260613_phase18_demo_crm_booking.sql
```

5. Run it manually.
6. Verify the result with:

```sql
select
  (select count(*) from customers) as customers_count,
  (select count(*) from bookings) as bookings_count,
  (select count(*) from customer_events) as customer_events_count;
```

Expected after seed:

```text
customers_count = 1
bookings_count = 1
customer_events_count = 1
```

7. Verify the demo customer:

```sql
select id, name, email, city, status, primary_service_category_slug, primary_service_slug
from customers
where source = 'demo_seed';
```

8. Verify the demo booking:

```sql
select id, title, service, status, starts_at, ends_at, service_category_slug, service_slug
from bookings
where source = 'demo_seed';
```

9. Verify the demo event:

```sql
select id, title, event_type, metadata
from customer_events
where metadata->>'source' = 'demo_seed';
```

## Rollback steps

If the seed must be removed, run:

```text
db/seeds/20260613_phase18_demo_crm_booking_rollback.sql
```

Expected after rollback:

```text
customers_count = 0
bookings_count = 0
customer_events_count = 0
```

## Next phase

After seed verification, continue to:

```text
Phase 18.4 — Read-only dashboard DB integration
```
