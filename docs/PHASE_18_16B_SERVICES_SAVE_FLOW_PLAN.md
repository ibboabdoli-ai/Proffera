# Phase 18.16B — Services Save/Edit Flow Plan

Goal: add a safe dashboard write flow for `workspace_services`.

Scope:

- create service
- edit service
- activate/deactivate service
- no delete
- write only to `workspace_services`
- use only `workspace_id = 'default'`
- require internal access code
- validate on the server

Allowed files:

```text
src/lib/workspace-services-db.ts
src/app/dashboard/installningar/service-actions.ts
src/app/dashboard/installningar/services-read-only.tsx
src/app/dashboard/installningar/page.tsx
docs/PHASE_18_16B_SERVICES_SAVE_FLOW_PLAN.md
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

Validation:

- `name`: required, max 140 chars
- `description`: max 500 chars
- `category`: max 120 chars
- `price_label`: max 120 chars
- `base_price_sek`: optional integer >= 0
- `duration_minutes`: optional integer 1-1440
- `service_area`: max 240 chars
- `is_active`: boolean
- `sort_order`: integer 0-9999

Forbidden:

- no service delete
- no booking integration
- no public integration
- no CRM changes
- no chat changes
- no Brevo changes

Acceptance criteria:

1. A service can be created with access code.
2. A service can be edited with access code.
3. Invalid data is rejected server-side.
4. Only `workspace_services` is changed.
5. Existing company profile save still works.
6. Production test data is restored after testing.
