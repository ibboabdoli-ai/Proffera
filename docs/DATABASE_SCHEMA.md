# Proffera Database Schema

Proffera uses Neon/Postgres. The executable source of truth is the ordered SQL
under [`db/migrations`](../db/migrations), not this summary.

## Active schema areas

- Better Auth core tables and Proffera workspaces/memberships.
- Workspace plans, Stripe subscription state and feature flags.
- Customers, bookings, services and booking hours.
- Public quote requests, company demo registrations and delivery/outbox records.
- `public_submission_rate_limits` plus recorded company consent, introduced by
  `20260722_0012_public_form_safety.sql`.

## Migration rule

Apply each migration once, in filename order, first in Preview and then in
production after verification. Record the applied revision and do not edit a
migration that may already have run. Use a new forward migration for every
schema change.
