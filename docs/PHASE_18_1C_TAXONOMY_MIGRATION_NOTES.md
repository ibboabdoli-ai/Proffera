# Phase 18.1C — Taxonomy-aware CRM/booking migration notes

Status: prepared file only. No database execution.

## Decision

The first Booking/CRM migration should support Proffera service taxonomy with soft slug fields instead of creating full taxonomy tables immediately.

## Updated migration file

```text
db/migrations/20260613_phase18_booking_crm.sql
```

## Added soft taxonomy fields

Customers:

- `primary_service_category_slug`
- `primary_service_slug`

Bookings:

- `service_category_slug`
- `service_slug`

## Why this is safer

- Keeps Phase 18.1 small.
- Does not change existing lead tables.
- Does not require service seed data yet.
- Allows dashboard filters by service category later.
- Keeps the future path open for real taxonomy tables.

## Protected existing flow

This phase must not change:

- `quote_requests`
- `company_registrations`
- `lead_outbox`
- `/admin`
- matching workflow
- Brevo lead delivery

## Future option

If Proffera needs managed service configuration later, add a separate reviewed phase for:

- `service_categories`
- `services`
- `company_services`
