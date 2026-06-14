# Phase 18.16B — Services Save/Edit Flow Plan

Date: 2026-06-14
Repository: `ibboabdoli-ai/Proffera`

## Goal

Add a safe dashboard write flow for `workspace_services`.

The user should be able to create and edit services from `/dashboard/installningar`.

Phase 18.16B must keep the scope narrow:

- write only to `workspace_services`
- use only `workspace_id = 'default'`
- require internal access code
- validate on the server
- allow activate/deactivate
- do not add delete

## Current baseline

Phase 18.16A is complete:

- `workspace_services` table exists
- default services are seeded
- settings page shows services read-only

## Allowed files

```text
src/lib/workspace-services-db.ts
src/app/dashboard/installningar/service-actions.ts
src/app/dashboard/installningar/services-read-only.tsx
src/app/dashboard/installningar/page.tsx
docs/PHASE_18_16B_SERVICES_SAVE_FLOW_PLAN.md
```

## Writable fields

```text
name
description
category
price_label
base_price_sek
duration_minutes
service_area
is_active
sort_order
```

## Server validation

| Field | Required | Rule |
|---|---:|---|
| `name` | yes | max 140 chars |
| `description` | no | max 500 chars |
| `category` | no | max 120 chars |
| `price_label` | no | max 120 chars |
| `base_price_sek` | no | integer >= 0 |
| `duration_minutes` | no | integer 1-1440 |
| `service_area` | no | max 240 chars |
| `is_active` | yes | boolean |
| `sort_order` | yes | integer 0-9999 |

## Proposed actions

Create:

```ts
createWorkspaceServiceAction(formData: FormData)
```

Update:

```ts
updateWorkspaceServiceAction(formData: FormData)
```

No delete action in this phase.

## DB helper functions

Add to `src/lib/workspace-services-db.ts`:

```ts
createDashboardWorkspaceService(input)
updateDashboardWorkspaceService(input)
```

Both helpers must include:

```sql
where workspace_id = 'default'
```

for updates.

## UI plan

In `/dashboard/installningar`:

- keep company profile form unchanged
- keep current service cards visible
- add one create service form
- add simple edit fields per service
- include access code for service writes
- show success/error query params

## Forbidden

Do not touch:

```text
customers
bookings
customer_events
quote_requests
company_registrations
lead_outbox
matching
Brevo
admin flow
public pages
Service AI Chat
```

Do not add:

- service delete
- booking integration
- public pricing integration
- email automation
- multi-workspace selector

## Manual test

After deploy:

1. Create temporary service:

```text
Testtjänst
```

2. Confirm it appears in Tjänster.
3. Edit `price_label` to:

```text
Offert test
```

4. Set inactive.
5. Restore or remove manually from Neon if needed.

## Acceptance criteria

Phase 18.16B is complete when:

1. A service can be created with access code.
2. A service can be edited with access code.
3. Server validation blocks invalid data.
4. No delete action exists.
5. Only `workspace_services` is changed.
6. Existing company profile save still works.
7. Production data is restored to a clean state after tests.
