# Phase 18.12 — Booking status update verification

Status: verified
Date: 2026-06-13

## Scope

Phase 18.12 verified the controlled booking status update flow on the booking profile page.

The status update flow is intentionally limited:

- Updates only the `status` field in the `bookings` table.
- Requires internal write access code.
- Does not create a new booking.
- Does not delete any booking.
- Does not create a `customer_events` row.
- Does not send email or reminders.
- Does not modify leads, matching, lead outbox, quote requests or admin delivery workflows.

## Test target

Seeded demo booking:

- Title: `Demo booking – Hemstädning`
- Customer: `Demo Kund – Sara Andersson`
- Original status: `confirmed` / Bekräftad
- Original source: `demo_seed`

## Test 1 — Change status from Bekräftad to Klar

Action:

- Opened the booking profile for `Demo booking – Hemstädning`.
- Used the `Ändra status` form.
- Changed status to `Klar` / `completed`.

Observed result in `/dashboard/bokningar`:

- `Bokningar i CRM = 1`
- `Bekräftade = 0`
- `Förfrågade = 0`
- `Klara = 1`
- `Demo booking – Hemstädning` showed status `Klar`.

Assessment:

- Status update from `confirmed` to `completed` worked.
- The booking count stayed stable at `1`.
- No additional booking was created.

## Test 2 — Roll back status from Klar to Bekräftad

Action:

- Opened the same booking profile again.
- Used the `Ändra status` form.
- Changed status back to `Bekräftad` / `confirmed`.

Observed result in `/dashboard/bokningar`:

- `Bokningar i CRM = 1`
- `Bekräftade = 1`
- `Förfrågade = 0`
- `Klara = 0`
- `Demo booking – Hemstädning` showed status `Bekräftad`.

Assessment:

- Rollback to the original demo baseline worked.
- The dashboard returned to the expected clean seed state.

## Final assessment

Phase 18.12 is verified.

The controlled status update flow works and can be used for future CRM workflow testing, with the current safety boundary that it updates only the booking status and does not trigger customer history or messaging workflows.
