# Phase 18.13 — Event logging verification

Status: verified
Date: 2026-06-14

## Summary

Phase 18.13 verifies that a booking status change creates a customer history event.

## Verified flow

The seeded demo booking was changed from `Bekräftad` to `Klar`.

Observed on booking profile:

- Status: `Klar`
- Customer: `Demo Kund – Sara Andersson`
- Event count: `2`
- New event type: `Statusändring`
- New event title: `Booking status updated`
- New event text: `Status changed from confirmed to completed.`

## Fix included

The event insert was adjusted to match the current `customer_events` schema:

- visible text stored in `description`
- status context stored in `metadata`

## Baseline restored

After verification, the demo booking was returned to `Bekräftad`.

Observed on booking list:

- `Bokningar i CRM = 1`
- `Bekräftade = 1`
- `Förfrågade = 0`
- `Klara = 0`

## Result

Phase 18.13 is verified.
