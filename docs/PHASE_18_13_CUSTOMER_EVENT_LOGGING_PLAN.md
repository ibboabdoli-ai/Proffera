# Phase 18.13 — Customer event logging plan

Status: planned only
Date: 2026-06-13

## Purpose

Phase 18.13 defines how Proffera should safely write customer history events into `customer_events` when important dashboard actions happen.

This phase is plan-only. No implementation is included in this step.

## Current baseline

The dashboard currently supports:

- Reading customers from Neon.
- Reading bookings from Neon.
- Reading booking/customer history from `customer_events`.
- Creating dashboard customers with `source = 'dashboard_manual'`.
- Creating dashboard bookings with `source = 'dashboard_manual'`.
- Updating booking status with internal access code.

Recent verified states:

- Phase 18.11 create-booking form was accepted with a documented limitation.
- Phase 18.12 booking status update was verified.
- The demo database baseline was restored after tests.

## Problem to solve

The dashboard has customer and booking history views, but most dashboard write actions currently do not create a history event.

This means a user can update a booking status but the customer profile may not show a timeline entry explaining what changed.

## Proposed first implementation target

The first event-logging implementation should be small and isolated:

- Add one `customer_events` insert when a booking status is updated.
- Event should be linked to both the customer and booking.
- Event should be created only after the booking status update succeeds.
- Event should not send any email or external notification.

## Proposed event for booking status update

When a booking status changes, create one event:

```sql
insert into customer_events (
  workspace_id,
  customer_id,
  booking_id,
  event_type,
  title,
  body,
  source
) values (
  'default',
  <customer_id>,
  <booking_id>,
  'status_change',
  'Booking status updated',
  'Status changed from <old_status> to <new_status>.',
  'dashboard_manual'
);
```

## Required data lookup

Before updating the booking status, the server action must load:

- Booking ID.
- Customer ID.
- Current booking status.
- Workspace ID.

After validation and successful status update, the server action can insert the event using the old and new statuses.

## Safety boundaries

This phase must not modify:

- Brevo/email delivery.
- SMS/reminder flows.
- `lead_outbox`.
- `quote_requests`.
- `company_registrations`.
- Lead matching.
- Public pages.
- Existing admin delivery workflows.

This phase should only affect:

- `bookings.status` update behavior.
- `customer_events` insert for that status change.

## Event rules

### Should create an event

- `confirmed` to `completed`.
- `completed` to `confirmed`.
- `requested` to `confirmed`.
- `confirmed` to `cancelled`.
- Any valid status change submitted through the dashboard status form.

### Should not create an event

- Failed access-code validation.
- Invalid status value.
- Failed database update.
- No-op update where old status equals new status.

## Cleanup strategy for tests

Manual status test events must be removable without touching seed events.

Recommended cleanup query:

```sql
begin;

delete from customer_events
where source = 'dashboard_manual'
  and event_type = 'status_change'
  and title = 'Booking status updated'
  and booking_id in (
    select id
    from bookings
    where title = 'Demo booking – Hemstädning'
      and source = 'demo_seed'
  );

update bookings
set status = 'confirmed'
where title = 'Demo booking – Hemstädning'
  and source = 'demo_seed';

commit;
```

Expected clean baseline after cleanup:

- `Bokningar i CRM = 1`.
- `Bekräftade = 1`.
- `Förfrågade = 0`.
- `Klara = 0`.
- Seeded demo booking remains linked to `Demo Kund – Sara Andersson`.
- Seeded demo event remains intact.
- Manual status-change events are removed.

## Implementation steps for next phase

1. Add a dashboard DB helper to load booking status-update context:
   - booking ID
   - customer ID
   - workspace ID
   - current status

2. Update the status action to:
   - validate access code
   - validate new status
   - load current booking context
   - skip event creation if status is unchanged
   - update `bookings.status`
   - insert a `customer_events` row with `event_type = 'status_change'`

3. Verify in production:
   - change demo booking from `confirmed` to `completed`
   - booking list shows `Klar`
   - booking/customer history gains one new status-change event
   - no email is sent
   - no lead/outbox/admin tables are changed

4. Roll back test data:
   - set demo booking back to `confirmed`
   - delete manual status-change event rows
   - confirm dashboard returns to baseline

## Acceptance criteria

Phase 18.13 implementation can be accepted only when:

- Booking status update still works.
- Exactly one `customer_events` row is created for a real status change.
- No event is created for invalid or failed updates.
- No email/external delivery is triggered.
- Cleanup returns the database to baseline.
- Existing demo seed event remains untouched.

## Final decision

Proceed with implementation only after this plan is accepted.
