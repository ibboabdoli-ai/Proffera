# Phase 18.6 — Customer profile/history read-only verification

Status: verified.

## Built

- Added read-only customer detail fetching to `src/lib/dashboard-db.ts`.
- Added a `Visa profil` link from `/dashboard/kunder`.
- Added `/dashboard/kunder/[id]` as a read-only customer profile route.
- The route shows customer profile data, bookings and customer history/events from Neon.

## Verified in production

The user verified the customer profile route with the seeded demo customer.

Verified page output included:

- Customer: `Demo Kund – Sara Andersson`
- Status: `Aktiv`
- Bookings: `1`
- Events: `1`
- Mode: `Read-only`
- Email: `demo.customer@proffera.se`
- Phone: `+46700000001`
- Service: `hemstadning`
- Booking: `Demo booking – Hemstädning`
- Event: `Demo event – booking confirmed`

## Safety

- No insert/update/delete actions were added.
- No admin route was changed.
- No Brevo flow was changed.
- No matching, outbox or lead-delivery flow was changed.
- The page only reads from `customers`, `bookings` and `customer_events`.

## Follow-up

Next safe step: decide whether to build read-only booking detail pages, CRM event timeline improvements, or carefully plan create/update forms with validation and rollback before adding any write actions.
