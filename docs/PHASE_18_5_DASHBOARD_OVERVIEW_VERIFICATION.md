# Phase 18.5 — Dashboard overview Neon read-only stats

Status: verified.

## Built

- Added read-only dashboard overview statistics backed by Neon.
- Connected `/dashboard` to CRM and booking counts through `src/lib/dashboard-db.ts`.
- Kept the overview read-only with no insert, update or delete actions.

## Verified production output

The user verified that production `/dashboard` shows:

- `Kunder = 1`
- `Bokningar = 1`
- `Kundhändelser = 1`
- `Läge = Read-only`

The page copy confirms that the overview reads verified CRM and booking data from Neon.

## Protected flows

No changes were made to:

- `/admin`
- Brevo delivery
- `quote_requests`
- `company_registrations`
- `lead_outbox`
- matching/outbox lead flow

## Current data state

The dashboard is now reading the seeded Phase 18 demo data:

- 1 customer
- 1 booking
- 1 customer event

## Next suggested phase

Continue with a small read-only customer history view before adding any write actions.

Suggested next step:

- Phase 18.6 — Customer detail/history read-only page
