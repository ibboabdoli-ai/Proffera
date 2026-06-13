# Phase 18.11 — Create Booking Form Verification

Date: 2026-06-13

## Scope

This document records the end-to-end verification of the dashboard create-booking form.

Implemented route:

- `/dashboard/bokningar/ny`

The implementation is intentionally limited to creating one booking record in the `bookings` table.

## Implemented safety boundaries

Verified boundaries:

- Internal access code is required.
- The form selects an existing customer from `customers`.
- The form writes only to `bookings`.
- Created booking uses `source = dashboard_manual`.
- No `customer_events` row is created.
- No Brevo/email/SMS/reminder flow is triggered.
- No lead, outbox, matching, or admin workflow is changed.
- No edit/delete/status-update action is exposed.

## Test booking created

Manual test booking created from the dashboard form:

- Title: `Test booking`
- Customer: `Demo Kund – Sara Andersson`
- Status: `requested` / Förfrågad
- City: `Södertälje`
- Service: `Hemstädning`
- Source: `dashboard_manual`
- Notes: `Test`

## Verified list view after creation

`/dashboard/bokningar` showed:

- `Bokningar i CRM = 2`
- `Bekräftade = 1`
- `Förfrågade = 1`
- `Klara = 0`

The list included:

- `Test booking` linked to `Demo Kund – Sara Andersson`
- `Demo booking – Hemstädning` remained intact

## Verified booking profile

`/dashboard/bokningar/[id]` for `Test booking` showed:

- Booking profile opened successfully
- Status: `Förfrågad`
- Customer: `Demo Kund – Sara Andersson`
- Events: `0`
- Mode: `Read-only`
- Start and end time visible
- City: `Södertälje`
- Service: `Hemstädning`
- Source: `dashboard_manual`
- Notes: `Test`
- Linked customer data visible
- `Visa kundprofil` link visible
- Booking history showed no events

## Cleanup required

The test booking should be removed after verification so the database returns to the clean demo baseline.

Cleanup target:

- Delete `Test booking` where `source = 'dashboard_manual'`

Expected clean state after cleanup:

- `Bokningar i CRM = 1`
- `Bekräftade = 1`
- `Förfrågade = 0`
- Demo booking remains intact

## Status

Phase 18.11 create-booking form is verified end-to-end. Cleanup remains the next step.