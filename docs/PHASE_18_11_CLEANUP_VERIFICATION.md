# Phase 18.11 — Create Booking Form Cleanup Verification

Date: 2026-06-13

## Scope

This document records the cleanup verification after testing the dashboard create-booking form.

## Verified state after cleanup

The temporary manual test booking was removed from Neon, and the booking dashboard returned to the expected clean demo state.

Verified dashboard values:

- Bokningar i CRM: 1
- Bekräftade: 1
- Förfrågade: 0
- Klara: 0
- Remaining booking: `Demo booking – Hemstädning`
- Removed test booking: `Test booking`

## Remaining booking details

The remaining booking shown in `/dashboard/bokningar`:

- Start: `15 juni 2026 17:13`
- Title: `Demo booking – Hemstädning`
- Customer: `Demo Kund – Sara Andersson`
- City: `Södertälje`
- Service: `Hemstädning`
- Status: `Bekräftad`

## Safety notes

- The create-booking form was tested successfully before cleanup.
- The temporary test booking created with `source = dashboard_manual` was removed.
- The seeded demo booking remains intact.
- The seeded demo customer remains intact.
- No customer event, email, reminder, lead, outbox, matching, Brevo, or admin workflow was changed by the cleanup verification.

## Current baseline

The booking dashboard baseline after cleanup is:

- `customers`: demo customer only
- `bookings`: demo booking only
- `customer_events`: demo event only

Phase 18.11 is verified end-to-end and cleaned up.