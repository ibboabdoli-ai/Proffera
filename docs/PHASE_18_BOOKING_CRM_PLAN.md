# Phase 18 — Booking and CRM MVP Plan

Status: planning only.

This document defines the first safe plan for adding Booking and CRM functionality to Proffera without breaking the existing lead, matching, outbox, admin or Brevo workflows.

## Current protected flow

Do not break these existing tables or flows:

- `quote_requests`
- `company_registrations`
- `lead_outbox`
- admin Basic Auth
- `/admin` routes
- matching workflow
- Brevo lead email delivery

## Phase 18.0 scope

Planning only:

- define customer data model
- define booking data model
- define status model
- define migration strategy
- define rollback strategy
- define dashboard integration plan

No database migration should be executed in Phase 18.0.

## Proposed new tables

### customers

Purpose: store CRM contacts and companies that can later be connected to leads and bookings.

Suggested fields:

- `id`
- `created_at`
- `updated_at`
- `type` — `private` or `company`
- `name`
- `email`
- `phone`
- `company_name`
- `city`
- `address`
- `source`
- `status` — `new`, `active`, `prospect`, `inactive`
- `notes`

### bookings

Purpose: store appointments, demos, cleaning jobs or service visits.

Suggested fields:

- `id`
- `created_at`
- `updated_at`
- `customer_id`
- `lead_ref`
- `service`
- `title`
- `description`
- `city`
- `address`
- `start_time`
- `end_time`
- `status` — `draft`, `requested`, `confirmed`, `completed`, `cancelled`
- `source`
- `notes`

### customer_events

Purpose: simple customer history timeline.

Suggested fields:

- `id`
- `created_at`
- `customer_id`
- `booking_id`
- `lead_ref`
- `type` — `note`, `call`, `email`, `booking`, `status_change`
- `title`
- `body`

## Status model

Customer status:

- `new`
- `prospect`
- `active`
- `inactive`

Booking status:

- `draft`
- `requested`
- `confirmed`
- `completed`
- `cancelled`

Lead-to-booking flow:

1. Lead arrives in existing lead flow.
2. Admin or SaaS user creates or links a customer.
3. User creates a booking draft.
4. Booking can be confirmed later.
5. Brevo booking confirmation should be added only after booking records are reliable.

## Dashboard integration plan

Phase 18.1 should keep static dashboard UI but prepare server-side data loading behind isolated functions.

Recommended order:

1. Add database migration for new tables only.
2. Add read-only list pages for customers and bookings.
3. Add create forms with server actions or API routes.
4. Add customer history timeline.
5. Add booking status updates.
6. Only then add Brevo booking confirmation emails.

## Migration plan

Before running migration:

- record latest safe commit
- verify current admin and Brevo lead flow still works
- create migration SQL in a small isolated commit
- avoid altering existing tables
- avoid renaming existing columns
- avoid deleting data

Migration should only create new tables at first.

## Rollback plan

If migration causes application issues:

1. Revert application code commit first.
2. Keep new tables if unused and harmless.
3. If tables must be removed, use explicit `DROP TABLE` only after confirming no production data is needed.
4. Never drop existing `quote_requests`, `company_registrations` or `lead_outbox`.

## Phase 18.1 recommended next step

Create isolated database migration for:

- `customers`
- `bookings`
- `customer_events`

Then add read-only dashboard pages that can later consume these tables.

## Non-goals for Phase 18.1

Do not implement yet:

- Stripe
- AI sending
- automatic Brevo booking emails
- external calendar sync
- SMS
- invoice generation
- replacing existing admin workflow
