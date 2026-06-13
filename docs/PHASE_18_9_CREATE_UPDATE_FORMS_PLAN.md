# Phase 18.9 — Create/update forms plan

Status: planning only. No implementation in this phase.

Date: 2026-06-13

## Goal

Define a safe implementation plan for future dashboard write flows before adding any create, update or delete actions.

Future write flows to plan:

- Create customer
- Create booking
- Update booking status
- Add customer event/note

This phase does not add those flows. It only defines how they should be implemented safely.

## Hard constraints

- Do not change the existing MVP lead/offert flow.
- Do not modify `quote_requests`, `company_registrations` or `lead_outbox`.
- Do not change admin, matching, outbox, Brevo or lead email workflows.
- Do not add delete actions in the first write implementation phase.
- Do not expose environment variables or admin secrets.
- Keep dashboard write flows separate from `/admin`.
- Keep all new write actions behind validation and a clear rollback path.

## Existing read-only foundation

Already verified:

- `/dashboard` reads Neon counts for customers, bookings and customer events.
- `/dashboard/kunder` reads customers from Neon.
- `/dashboard/kunder/[id]` reads customer profile, bookings and history.
- `/dashboard/bokningar` reads bookings from Neon.
- `/dashboard/bokningar/[id]` reads booking profile, linked customer and history.

Current database tables:

- `customers`
- `bookings`
- `customer_events`

## Recommended implementation sequence

### Phase 18.10 — Create customer form

Scope:

- Add `/dashboard/kunder/ny`.
- Add a server action or route handler for validated customer creation.
- Insert into `customers` only.
- Optionally insert a `customer_events` row of type `note` or `status_change` after successful creation.

Do not:

- Create booking at the same time.
- Send email.
- Touch lead tables.
- Add delete.

Required fields:

- `name`
- `customer_type`
- `status`

Optional fields:

- `email`
- `phone`
- `company_name`
- `city`
- `primary_service_category_slug`
- `primary_service_slug`
- `notes`

Validation:

- `name` required, trimmed, max 120 characters.
- `email` optional but must be email-shaped when supplied.
- `phone` optional, trimmed, max 40 characters.
- `customer_type` must be `private` or `company`.
- `status` must be `prospect`, `active`, `paused` or `lost`.
- Service slugs must come from `src/lib/service-taxonomy.ts` if supplied.

Rollback strategy:

- Each created customer gets `source = 'dashboard_manual'`.
- Rollback can remove test/manual records by exact `id` or by `source` in a reviewed manual SQL script.
- If a customer event is created, delete event before customer.

Verification:

- Create one test customer.
- Verify `/dashboard/kunder` count increases.
- Verify `/dashboard/kunder/[id]` opens.
- Verify no change to `quote_requests`, `company_registrations` or `lead_outbox`.

### Phase 18.11 — Create booking form

Scope:

- Add `/dashboard/bokningar/ny`.
- Allow choosing an existing customer from `customers`.
- Insert into `bookings` only.
- Optionally insert a `customer_events` row of type `booking` after successful creation.

Do not:

- Create a new customer inside the booking form in the first pass.
- Send email confirmations yet.
- Add calendar integration yet.
- Add delete.

Required fields:

- `title`
- `status`

Optional fields:

- `customer_id`
- `service`
- `service_category_slug`
- `service_slug`
- `city`
- `starts_at`
- `ends_at`
- `notes`

Validation:

- `title` required, trimmed, max 160 characters.
- `status` must be `draft`, `requested`, `confirmed`, `completed`, `cancelled` or `no_show`.
- `customer_id` must reference an existing customer if supplied.
- `ends_at` must be after `starts_at` when both are supplied.
- Service slugs must come from `src/lib/service-taxonomy.ts` if supplied.

Rollback strategy:

- Each created booking gets `source = 'dashboard_manual'`.
- Rollback can remove test/manual booking by exact `id`.
- Delete related `customer_events` before deleting a booking.

Verification:

- Create one test booking for an existing customer.
- Verify `/dashboard/bokningar` count increases.
- Verify `/dashboard/bokningar/[id]` opens.
- Verify linked customer still opens.
- Verify no change to existing lead flow tables.

### Phase 18.12 — Update booking status

Scope:

- Add controlled status update action on booking detail page.
- Update only `bookings.status` and `bookings.updated_at`.
- Insert a `customer_events` row of type `status_change`.

Do not:

- Send emails yet.
- Allow arbitrary booking edits yet.
- Add delete.

Validation:

- New status must be in allowed booking status enum.
- Booking must exist.
- Store old status and new status in event metadata.

Rollback strategy:

- Manual SQL can revert status by exact booking `id`.
- Status-change event can be deleted by exact event `id` if needed.

### Phase 18.13 — Add customer note/event

Scope:

- Add a simple note form on customer profile.
- Insert into `customer_events` with `event_type = 'note'`.

Do not:

- Edit notes yet.
- Delete notes yet.
- Add email/SMS automation yet.

Validation:

- Customer must exist.
- Title required, max 160 characters.
- Description optional, max 2000 characters.

Rollback strategy:

- Delete event by exact `id`.

## Permission model before real customers

Before real customer use, decide and implement one of these:

- Temporary internal dashboard access gate.
- Reuse a dashboard-specific access code.
- Proper account/workspace auth.

Do not expose CRM write flows publicly without authentication.

## Tenant/workspace note

Current schema uses `workspace_id text default 'default'`.

Before onboarding several real businesses, improve this into a stronger tenant model. The first write phases may continue using `workspace_id = 'default'` while Proffera is still in controlled internal testing.

## Brevo and automation boundary

Email/SMS confirmations are intentionally excluded from the first create/update form phases.

Later automation phases should be separate:

- Booking confirmation email
- Booking reminder email/SMS
- Customer notification preferences
- Delivery log for booking communications

These should not reuse or break the existing lead outbox flow without a separate design.

## Acceptance criteria for Phase 18.9

- A planning document exists.
- No write code has been added.
- No database schema has been changed.
- Existing dashboard read-only pages remain the current production behavior.
- Next implementation phase is explicitly limited to `Create customer` unless reviewed otherwise.
