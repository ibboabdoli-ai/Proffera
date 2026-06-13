# Phase 18.3 — DB state after demo CRM/booking seed

Status: executed manually in Neon and verified.

## Verified counts

```text
customers_count = 1
bookings_count = 1
customer_events_count = 1
```

## Verified table list

```text
bookings
company_registrations
customer_events
customers
lead_outbox
quote_requests
```

## Seed files

- `db/seeds/20260613_phase18_demo_crm_booking.sql`
- `db/seeds/20260613_phase18_demo_crm_booking_rollback.sql`
- `docs/PHASE_18_3_DEMO_SEED_INSTRUCTIONS.md`

## Safety notes

- Existing lead-flow tables remain present.
- Existing admin, matching, outbox and Brevo workflows were not changed.
- Demo CRM/booking data is now available for future read-only dashboard work.

## Next recommended step

Continue with a read-only dashboard integration plan before connecting dashboard pages to the new database tables.
