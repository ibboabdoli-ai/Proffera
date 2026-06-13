# Phase 18.10 — Create Customer Form Verification

Date: 2026-06-13

## Scope

Phase 18.10 implemented the first controlled dashboard write action:

- Route: `/dashboard/kunder/ny`
- Write target: `customers` only
- Created records use `source = 'dashboard_manual'`
- The existing read-only customer list remains unchanged except that it now includes a `Ny kund` entry point
- No booking writes were added
- No customer update/delete flows were added
- No admin, matching, outbox, Brevo or lead email logic was changed

## User verification

The user verified that the form renders correctly on `/dashboard/kunder/ny` with:

- Internal access code field
- Name field
- Customer type field
- Status field
- Email field
- Phone field
- Company name field
- City field
- Primary service field
- Notes field
- Safety boundary text
- Submit button

The user then submitted a test customer through the form.

Verified result on `/dashboard/kunder`:

- `Kontakter i CRM` increased from `1` to `2`
- `Aktiva kunder` remained `1`
- `Prospekt` increased from `0` to `1`
- New customer displayed: `Test Kund Proffera`
- Customer type/city displayed: `Privatkund · Södertälje`
- Status displayed: `Prospekt`
- Service displayed: `hemstadning`
- Notes displayed: `Test customer created from dashboard form.`
- Existing demo customer remained visible and unchanged

## Expected database impact

A single row should have been inserted into `customers` with:

- `full_name = 'Test Kund Proffera'`
- `customer_type = 'private'`
- `status = 'prospect'`
- `email = 'test.kund@proffera.se'`
- `phone = '+46700000002'`
- `city = 'Södertälje'`
- `primary_service_slug = 'hemstadning'`
- `source = 'dashboard_manual'`

## Test cleanup SQL

Run this manually in Neon only if the test customer should be removed after verification:

```sql
begin;

delete from customer_events
where customer_id in (
  select id
  from customers
  where email = 'test.kund@proffera.se'
    and source = 'dashboard_manual'
);

delete from bookings
where customer_id in (
  select id
  from customers
  where email = 'test.kund@proffera.se'
    and source = 'dashboard_manual'
);

delete from customers
where email = 'test.kund@proffera.se'
  and source = 'dashboard_manual';

commit;
```

Expected result after cleanup:

- `customers_count` returns to `1` if no other manual customers were created
- `/dashboard/kunder` shows only the seeded demo customer again

## Status

Phase 18.10 is verified as working end-to-end.

Recommended next step: run the cleanup SQL for the test customer before moving to Phase 18.11.
