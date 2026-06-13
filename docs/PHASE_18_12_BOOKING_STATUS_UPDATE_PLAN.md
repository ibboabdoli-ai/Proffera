# Phase 18.12 — Controlled Booking Status Update Plan

Date: 2026-06-13

## Goal

Plan a safe, isolated booking status update flow before implementation.

Target use case:

- Change status for an existing booking from the dashboard booking profile.

This phase is planning only. No functional status update form, server action, database update or event creation is implemented in this step.

## Context

Phase 18.11 verified that the dashboard can safely create one booking record with:

- internal access-code protection
- customer existence validation
- isolated insert into `bookings`
- `source = 'dashboard_manual'`
- no customer event creation
- no Brevo/email side effects
- successful test cleanup

Phase 18.12 should keep the same safety model but update an existing booking's status.

## Allowed scope for implementation phase

The future implementation may add:

- A small status update form on `/dashboard/bokningar/[id]`
- A server action for updating only `bookings.status`
- Optional update of `bookings.updated_at = now()`
- Access-code validation before update
- Redirect back to the same booking profile after success

## Explicitly out of scope

Do not implement in the first status-update phase:

- Booking delete
- Booking hard cancel/delete workflow
- Customer edit
- Booking date/time edit
- Service edit
- Notes/event creation
- Automatic customer event creation
- Brevo emails
- SMS reminders
- Calendar integration
- AI assistant actions
- Lead/outbox/matching changes
- Admin workflow changes

## Status options

Use the booking statuses already supported by the database/UI:

- `requested`
- `confirmed`
- `completed`
- `cancelled`

The database also supports `draft` and `no_show`, but keep the first dashboard update UI limited to the four statuses above.

## Validation rules

Before update:

- Access code must match `DASHBOARD_WRITE_CODE` or fallback `ADMIN_ACCESS_CODE`.
- Booking ID must exist in `bookings` for `workspace_id = 'default'`.
- New status must be one of the allowed statuses.
- Do not update if the status is invalid.
- Do not update other booking fields.
- Do not write to `customer_events` in this phase.

## Database write shape

The future implementation should update only `bookings.status` and `updated_at`:

```sql
update bookings
set
  status = $new_status,
  updated_at = now()
where workspace_id = 'default'
  and id = $booking_id
returning id;
```

No insert into `customer_events` should be added in the first status-update implementation.

## Test plan

Use the existing demo booking:

- Title: `Demo booking – Hemstädning`
- Current status: `confirmed`

Safe test sequence:

1. Open the demo booking profile.
2. Change status from `confirmed` to `requested` using the internal access code.
3. Verify `/dashboard/bokningar` shows:
   - `Bokningar i CRM = 1`
   - `Bekräftade = 0`
   - `Förfrågade = 1`
4. Change status back from `requested` to `confirmed`.
5. Verify `/dashboard/bokningar` returns to baseline:
   - `Bokningar i CRM = 1`
   - `Bekräftade = 1`
   - `Förfrågade = 0`
   - `Klara = 0`

## Rollback path

If the UI test leaves the demo booking in the wrong status, reset it manually in Neon:

```sql
update bookings
set
  status = 'confirmed',
  updated_at = now()
where title = 'Demo booking – Hemstädning'
  and source = 'demo_seed';
```

Expected baseline after rollback:

- `Bokningar i CRM = 1`
- `Bekräftade = 1`
- `Förfrågade = 0`
- `Klara = 0`
- Demo booking remains visible and linked to Demo Kund – Sara Andersson

## Verification checklist for future implementation

After implementation and deploy:

1. Open `/dashboard/bokningar/[id]` for the demo booking.
2. Confirm current status is `Bekräftad`.
3. Confirm status update form renders.
4. Submit status change to `Förfrågad` with internal access code.
5. Confirm booking profile shows `Förfrågad`.
6. Confirm `/dashboard/bokningar` stats update correctly.
7. Submit status change back to `Bekräftad`.
8. Confirm profile and list return to baseline.
9. Confirm no customer event is created.
10. Confirm no email/Brevo action is triggered.

## Safety rule

Do not proceed to Phase 18.12 implementation until this plan is accepted and current production deploy is green.