# Phase 18.16 — Services / Tjänster Settings Plan

Date: 2026-06-14
Repository: `ibboabdoli-ai/Proffera`
Production domain: `https://proffera.se`

## Purpose

Build the next settings area in `/dashboard/installningar`: `Tjänster`.

This phase should let Proffera define services that can later be used by booking, quote, public demo, matching, and AI assistant flows.

The first implementation must be safe and limited. Do not build a broad service marketplace system yet.

## Current state

The settings page currently has four cards:

- `Företagsprofil` — active
- `Tjänster` — coming
- `Notiser` — coming
- `AI-svar` — coming

`Företagsprofil` is now editable through `workspace_settings`.

`Tjänster` is still only a placeholder card and has no verified dedicated database table in the current project.

## Important constraints

Follow the Phase 18 safety sequence:

- Work step by step.
- Use one isolated write scope per phase.
- Keep rollback/checkpoint branches.
- Avoid unnecessary deploys.
- Do not touch public pages until dashboard data is stable.
- Do not touch booking/CRM flows unless explicitly approved.
- Do not implement delete actions in the first pass.

## Recommended phase split

### Phase 18.16A — Services DB baseline + read-only dashboard

Goal:

- Add a safe `workspace_services` table.
- Seed a few default Proffera services.
- Show services in `/dashboard/installningar` in read-only mode.
- Keep `Tjänster` card as `Aktiv` only after read-only verification.

No save form yet.

### Phase 18.16B — Create/edit service form

Goal:

- Add controlled create/edit flow for services.
- Require internal access code.
- Validate all fields server-side.
- Allow enable/disable, not delete.

### Phase 18.16C — Connect services to booking/public/demo later

Goal:

- Only after service settings are stable.
- Connect selected service data to booking/demo or quote flows.
- This must be a separate reviewed phase.

## Proposed database table

Recommended table name:

```sql
workspace_services
```

Recommended first schema:

```sql
create table if not exists workspace_services (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null default 'default',
  name text not null,
  description text not null default '',
  category text not null default '',
  price_label text not null default '',
  base_price_sek integer,
  duration_minutes integer,
  service_area text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_workspace_services_workspace_id on workspace_services (workspace_id);
create index if not exists idx_workspace_services_active on workspace_services (workspace_id, is_active, sort_order);
```

### Why these fields?

| Field | Why |
|---|---|
| `workspace_id` | Keeps future multi-workspace path open. |
| `name` | Service name shown in dashboard/public later. |
| `description` | Short service explanation. |
| `category` | Example: Lokalvård, Hemstädning, Frisör, Klinik. |
| `price_label` | Flexible display like `Från 499 kr`, `Offert`, `299 kr`. |
| `base_price_sek` | Optional numeric price for later calculations. |
| `duration_minutes` | Optional duration for booking later. |
| `service_area` | Simple text first, e.g. `Stockholm, Södertälje`. |
| `is_active` | Safe alternative to delete. |
| `sort_order` | Stable dashboard/public ordering. |

## Seed data proposal

For Proffera demo, keep the seed generic and SaaS-safe:

```sql
insert into workspace_services (
  workspace_id,
  name,
  description,
  category,
  price_label,
  base_price_sek,
  duration_minutes,
  service_area,
  is_active,
  sort_order
)
values
  (
    'default',
    'Demo / konsultation',
    'Kort genomgång av företagets boknings- och leadflöde.',
    'SaaS',
    'Boka demo',
    null,
    30,
    'Online / Stockholm',
    true,
    10
  ),
  (
    'default',
    'Leadhantering',
    'Strukturerad hantering av inkommande förfrågningar och kunddialog.',
    'CRM',
    'Offert',
    null,
    null,
    'Sverige',
    true,
    20
  ),
  (
    'default',
    'Bokningsflöde',
    'Digital bokningsvy för tider, kunder och status.',
    'Bokning',
    'Offert',
    null,
    null,
    'Sverige',
    true,
    30
  )
on conflict do nothing;
```

Important: if we need idempotent seed behavior, add a unique constraint such as:

```sql
unique (workspace_id, name)
```

Then use:

```sql
on conflict (workspace_id, name) do nothing
```

## Phase 18.16A implementation plan

Allowed files:

```text
db/migrations/20260614_phase18_16_workspace_services.sql
src/lib/workspace-services-db.ts
src/app/dashboard/installningar/page.tsx
```

Steps:

1. Create migration for `workspace_services`.
2. Execute migration manually in Neon.
3. Add read helper:

```ts
getDashboardWorkspaceServices()
```

4. Update `/dashboard/installningar`:
   - set `Tjänster` status to `Aktiv`
   - show a read-only service list below or beside company profile
   - no save form yet
5. Verify production shows services.

## Phase 18.16B implementation plan

Only after 18.16A is verified.

Additional allowed files likely:

```text
src/app/dashboard/installningar/service-actions.ts
src/lib/workspace-services-db.ts
src/app/dashboard/installningar/page.tsx
```

Writable fields:

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

Validation rules:

| Field | Required | Rule |
|---|---:|---|
| `name` | yes | max 140 |
| `description` | no | max 500 |
| `category` | no | max 120 |
| `price_label` | no | max 120 |
| `base_price_sek` | no | integer >= 0 |
| `duration_minutes` | no | integer 1-1440 |
| `service_area` | no | max 240 |
| `is_active` | yes | boolean |
| `sort_order` | yes | integer 0-9999 |

Rules:

- Require access code.
- Do not allow delete.
- Use deactivate via `is_active = false`.
- Update only `workspace_id = 'default'` in this phase.
- No public page dependency yet.

## Forbidden in Phase 18.16

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

- service delete action
- booking integration
- public pricing page integration
- automated email triggers
- multi-tenant workspace selector

## Manual verification checklist

### After migration

Run:

```sql
select
  workspace_id,
  name,
  category,
  price_label,
  duration_minutes,
  service_area,
  is_active,
  sort_order
from workspace_services
where workspace_id = 'default'
order by sort_order, name;
```

Expected:

- at least three seeded services
- all belong to `default`
- active services show `true`

### After read-only UI

Open:

```text
https://proffera.se/dashboard/installningar
```

Expected:

- `Tjänster` card is `Aktiv`
- service list is visible
- no edit/create/delete service button in 18.16A
- company profile still works

### After save/edit UI in 18.16B

Test one harmless update:

```text
Bokningsflöde -> price_label = Offert test
```

Then restore:

```text
Bokningsflöde -> price_label = Offert
```

## Rollback plan

### Code rollback

Revert the PR for the current subphase.

### Data rollback for 18.16A

If the table should be removed before real usage:

```sql
drop table if exists workspace_services;
```

If only seed data should be reset:

```sql
delete from workspace_services
where workspace_id = 'default';
```

Then rerun the approved seed if needed.

## Acceptance criteria for Phase 18.16A

Phase 18.16A is complete when:

1. `workspace_services` table exists in Neon.
2. Default services are seeded.
3. `/dashboard/installningar` reads and displays services.
4. There is no service write form yet.
5. Existing company profile save still works.
6. No protected flows were changed.

## Acceptance criteria for Phase 18.16B

Phase 18.16B is complete when:

1. A service can be created or edited with access code.
2. Server-side validation blocks invalid data.
3. Only `workspace_services` is updated.
4. Only `workspace_id = 'default'` is updated.
5. Services can be deactivated instead of deleted.
6. Production is restored to clean demo data after tests.
