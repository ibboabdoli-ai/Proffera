# Phase 18.11 — Create Booking Form Plan

Date: 2026-06-13

## Goal

Plan a safe, isolated booking creation flow for the SaaS dashboard before implementation.

Target route:

- `/dashboard/bokningar/ny`

This phase is planning only. No functional booking form, POST action, insert, update or delete is implemented in this step.

## Context

Phase 18.10 verified that a dashboard form can safely create one customer record in `customers` with:

- access-code protection
- basic validation
- `source = 'dashboard_manual'`
- test cleanup path

Phase 18.11 should follow the same safety model, but bookings are more sensitive because they must be linked to an existing customer.

## Allowed scope for implementation phase

The future implementation may add:

- A new page: `/dashboard/bokningar/ny`
- A booking creation server action
- One isolated insert into `bookings`
- A customer selector using existing `customers`
- Validation before the database insert
- Redirect back to `/dashboard/bokningar` after success

## Explicitly out of scope

Do not implement in the first booking form phase:

- Booking update/edit
- Booking delete/cancel
- Customer creation inside the booking form
- Automatic customer events
- Brevo emails
- SMS reminders
- Calendar integration
- AI assistant actions
- Matching or lead-outbox changes
- Admin workflow changes

## Required fields

The first booking form should require:

- Internal access code
- Customer ID from existing customers
- Title
- Start date/time
- End date/time
- City
- Service category/slug or no primary service
- Status

Optional fields:

- Notes

Recommended default values:

- `status = requested`
- `source = dashboard_manual`
- `workspace_id = default`

## Validation rules

Before insert:

- Access code must match `DASHBOARD_WRITE_CODE` or fallback `ADMIN_ACCESS_CODE`.
- Customer must exist in `customers`.
- Title must not be empty.
- Start time must be valid.
- End time must be valid.
- End time must be after start time.
- Status must be one of the allowed booking statuses.
- Service slug must exist in the frontend service taxonomy if selected.
- Do not write to `bookings` if validation fails.

## Booking status options

Use the statuses already supported by the CRM schema/UI:

- `requested`
- `confirmed`
- `done`
- `cancelled`

Recommended first default:

- `requested`

## Database write shape

The future implementation should insert only into `bookings`:

```sql
insert into bookings (
  workspace_id,
  customer_id,
  title,
  status,
  start_at,
  end_at,
  city,
  service_category_slug,
  service_slug,
  source,
  notes
) values (...);
```

No `customer_events` insert should be added in the first booking-form implementation. Event creation should be a separate later phase.

## Rollback / cleanup path for test booking

Use a unique test title and delete it after verification.

Recommended test booking:

- Title: `Test Booking Proffera`
- Customer: `Demo Kund – Sara Andersson`
- Status: `requested`
- Service: `Hemstädning`
- City: `Södertälje`
- Source: `dashboard_manual`

Cleanup SQL after test:

```sql
begin;

delete from customer_events
where booking_id in (
  select id
  from bookings
  where title = 'Test Booking Proffera'
    and source = 'dashboard_manual'
);

delete from bookings
where title = 'Test Booking Proffera'
  and source = 'dashboard_manual';

commit;
```

Expected dashboard after cleanup:

- `Bokningar i CRM = 1`
- `Bekräftade = 1`
- `Förfrågade = 0`
- Demo booking remains intact

## Verification checklist for future implementation

After implementation and deploy:

1. Open `/dashboard/bokningar`.
2. Confirm existing demo booking is visible.
3. Open `/dashboard/bokningar/ny`.
4. Confirm the form renders.
5. Submit a test booking using the internal access code.
6. Confirm redirect back to `/dashboard/bokningar`.
7. Confirm booking count increases from 1 to 2.
8. Confirm requested count increases from 0 to 1.
9. Confirm `Test Booking Proffera` is visible and linked to `Demo Kund – Sara Andersson`.
10. Confirm no email is sent.
11. Run cleanup SQL.
12. Confirm booking count returns to 1.

## Safety rule

Do not proceed to Phase 18.11 implementation until this plan is accepted and current production deploy is green.