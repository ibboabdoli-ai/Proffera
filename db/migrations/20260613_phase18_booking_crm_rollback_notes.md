# Phase 18.1 rollback notes

This is a non-executable rollback note for the Phase 18.1 Booking and CRM schema migration.

The executable migration file is:

- `db/migrations/20260613_phase18_booking_crm.sql`

Rollback scope:

- Only objects introduced by Phase 18.1 should be removed if the migration must be reverted.
- Existing lead-flow tables must remain untouched:
  - `quote_requests`
  - `company_registrations`
  - `lead_outbox`

Objects introduced by Phase 18.1:

- `customers`
- `bookings`
- `customer_events`
- indexes for these three tables

Safe rollback order:

1. Remove event-related indexes.
2. Remove booking-related indexes.
3. Remove customer-related indexes.
4. Remove `customer_events`.
5. Remove `bookings`.
6. Remove `customers`.

Important:

- Do not run rollback actions without first confirming that no production data must be kept.
- Do not change or remove existing admin, matching, outbox or Brevo flow.
- This rollback note is intentionally not executable.
