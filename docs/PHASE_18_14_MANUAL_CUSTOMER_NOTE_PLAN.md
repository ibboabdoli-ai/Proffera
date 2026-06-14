# Phase 18.14 — Manual customer note plan

Status: planned only
Date: 2026-06-14

## Purpose

Add a small dashboard feature for saving an internal note on a customer profile.

The note should appear in the customer history timeline as a `customer_events` row.

## Scope

Add a form on `/dashboard/kunder/[id]` with:

- title
- note text
- submit button

On submit, create one event:

- `event_type = note`
- linked to the customer
- not linked to a booking
- metadata marks it as a dashboard manual event

## Protected areas

This phase must not change:

- bookings
- quote requests
- company registrations
- lead outbox
- matching
- admin delivery flow
- email delivery
- public pages

## Validation

Required:

- customer exists
- title exists
- note exists

Limits:

- title max 140 characters
- note max 1000 characters

## Test

Use the seeded demo customer:

- `Demo Kund – Sara Andersson`
- `demo.customer@proffera.se`

Suggested test:

- Title: `Test note`
- Note: `Manual CRM note created from dashboard test.`

Expected result:

- customer profile history count increases by one
- new note appears in customer history
- no booking changes
- no external messages

## Cleanup

After verification, remove the test note event only.

Expected clean baseline:

- demo customer remains
- demo booking remains
- original seeded demo event remains
- manual test note is removed

## Acceptance criteria

Phase 18.14 is accepted only when:

- note form renders
- note can be saved
- note appears in customer history
- no booking row is changed
- no external workflow is triggered
- cleanup restores the baseline
