# Phase 18.7 — Booking profile verification

Status: verified by manual browser test.

## Scope

Phase 18.7 added a read-only booking detail page:

```text
/dashboard/bokningar/[id]
```

The page reads booking, linked customer, and related customer history from Neon.

## Verified result

Manual browser output confirmed that the booking profile page shows:

- Booking profile title and read-only description
- Booking status: Bekräftad
- Linked customer: Demo Kund – Sara Andersson
- Related event count: 1
- Read-only mode
- Booking details: start, end, city, service, source, created timestamp, note
- Linked customer card with email and phone
- Link to customer profile: Visa kundprofil
- Booking history from customer_events

## Safety check

This phase is read-only only.

No create, update, or delete actions were added.

Protected flows remain untouched:

- admin
- Brevo
- lead_outbox
- quote_requests
- company_registrations
- matching

## Verified data

The page used the seeded demo data:

- Customer: Demo Kund – Sara Andersson
- Booking: Demo booking – Hemstädning
- Event: Demo event – booking confirmed

## Commits in this phase

- `d58953b76b68b5ca192debbb9d897fa36b8f469d` — add read-only booking detail query
- `32bde8509592faebb4ed1be0353962ccbff209a8` — add booking detail link
- `a78c32aec3acccf4796da4a82e29f504051f37f8` — add booking detail page

## Result

Phase 18.7 is complete and verified.
