# Phase 18.15B — Settings Save Flow Plan

Date: 2026-06-14
Repository: `ibboabdoli-ai/Proffera`
Production domain: `https://proffera.se`

## Purpose

Add a safe, limited save flow for the company profile section in `/dashboard/installningar`.

This phase must only update the existing `workspace_settings` row for the default workspace.

## Current verified baseline

`workspace_settings` exists in Neon and has a verified row:

| Field | Current value |
|---|---|
| `workspace_id` | `default` |
| `company_name` | `Proffera` |
| `primary_city` | `Stockholm` |
| `response_time_goal` | `Inom 24 timmar` |
| `default_cta` | `Boka demo` |
| `contact_email` | empty string |
| `contact_phone` | empty string |

The current `/dashboard/installningar` page already reads these values in read-only mode.

## Important schema note

Use the real migration column name:

```sql
response_time_goal
```

Do **not** use the older planning name:

```sql
response_time_target
```

## Scope

Allowed:

- Add an edit/save form for the company profile card.
- Save only to `workspace_settings`.
- Save only the row where `workspace_id = 'default'`.
- Validate all form data before writing.
- Keep the current read-only view as the base state.
- Show a clear success/error message after submit.

Not allowed:

- Do not touch `customers`.
- Do not touch `bookings`.
- Do not touch `customer_events`.
- Do not touch `quote_requests`.
- Do not touch `company_registrations`.
- Do not touch `lead_outbox`.
- Do not touch matching logic.
- Do not touch Brevo.
- Do not touch admin flow.
- Do not touch public pages.
- Do not add a migration unless a new technical need is explicitly approved.

## Editable fields

The save flow may update only these fields:

```text
company_name
primary_city
response_time_goal
default_cta
contact_email
contact_phone
```

## Validation rules

| Field | Required | Max length | Extra rule |
|---|---:|---:|---|
| `company_name` | yes | 160 | trim whitespace |
| `primary_city` | yes | 120 | trim whitespace |
| `response_time_goal` | yes | 120 | trim whitespace |
| `default_cta` | yes | 80 | trim whitespace |
| `contact_email` | no | 180 | if filled, must look like an email |
| `contact_phone` | no | 80 | trim whitespace |

Empty optional fields should be saved as an empty string, not `null`, unless a later schema decision changes this.

## Proposed implementation

### 1. Extend DB helper

Current helper:

```text
src/lib/workspace-settings-db.ts
```

Add a write function, for example:

```ts
updateWorkspaceSettingsForDefaultWorkspace(input)
```

The function must:

- accept only the approved fields
- validate or receive already validated data
- update only `workspace_id = 'default'`
- set `updated_at = now()`
- return the updated row or a clear success result

### 2. Add server action or API route

Preferred first option: server action colocated with the settings page or a small isolated action file.

Rules:

- no client-side direct DB access
- no broad generic update helper
- no dynamic workspace id from user input in this phase
- no service/business setting changes outside company profile

### 3. Update `/dashboard/installningar`

Use the current page as base.

Add:

- form fields prefilled from DB
- save button
- disabled/loading state if using client component
- success state after save
- validation errors near fields or in a compact error box

Keep future cards as `Kommande`.

### 4. Cache/revalidation

The page already uses dynamic DB reading. After save:

- redirect back to `/dashboard/installningar?updated=1`, or
- revalidate and show a success message

Do not introduce stale settings cache.

## Manual test plan

### Before test

Confirm current baseline:

```sql
select
  workspace_id,
  company_name,
  primary_city,
  response_time_goal,
  default_cta,
  contact_email,
  contact_phone
from workspace_settings
where workspace_id = 'default';
```

Expected:

```text
Proffera
Stockholm
Inom 24 timmar
Boka demo
empty contact_email
empty contact_phone
```

### Test save

Change only one small value first:

```text
company_name = Proffera Test
```

Expected:

- form submits successfully
- page reloads or refreshes
- `Företagsnamn` shows `Proffera Test`
- Neon row also shows `Proffera Test`

### Rollback test data

After test, restore baseline:

```sql
update workspace_settings
set
  company_name = 'Proffera',
  primary_city = 'Stockholm',
  response_time_goal = 'Inom 24 timmar',
  default_cta = 'Boka demo',
  contact_email = '',
  contact_phone = '',
  updated_at = now()
where workspace_id = 'default';
```

## Verification checklist

Before merge:

- [ ] Diff only touches settings-related files.
- [ ] No migration added unless explicitly approved.
- [ ] No public page changed.
- [ ] No CRM/booking/event table changed.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Vercel preview is Ready.

After merge:

- [ ] Production deploy is Ready.
- [ ] `/dashboard/installningar` loads.
- [ ] Existing values still display.
- [ ] Save test works with one harmless value.
- [ ] Baseline is restored after test.

## Rollback plan

Code rollback:

- revert the PR/commit for Phase 18.15B
- keep the existing read-only Phase 18.15 behavior

Data rollback:

- run the SQL baseline restore statement above

## Acceptance criteria

Phase 18.15B is complete only when:

1. Company profile fields can be edited and saved.
2. Only `workspace_settings` is updated.
3. Only `workspace_id = 'default'` is updated.
4. Validation prevents empty required fields and invalid email.
5. Production still shows correct Proffera baseline after test rollback.
