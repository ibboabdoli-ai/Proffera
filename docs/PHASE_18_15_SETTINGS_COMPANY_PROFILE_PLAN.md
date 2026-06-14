# Phase 18.15 — Settings company profile plan

Status: planned only
Date: 2026-06-14

## Purpose

Phase 18.15 defines a safe first write step for the dashboard settings area.

The current `/dashboard/installningar` page is still a static preview. This phase should plan how to make the company/workspace profile editable without touching lead, booking or delivery workflows.

## Current settings page

Current route:

- `/dashboard/installningar`

Current behavior:

- Static preview only.
- No database connection.
- No save action.
- No settings table.

Current visible fields:

- Företagsnamn
- Primär ort
- Svarstid mål
- Standard CTA

## Proposed database table

Create a new table for workspace settings:

```sql
create table if not exists workspace_settings (
  workspace_id text primary key default 'default',
  company_name text,
  primary_city text,
  response_time_target text,
  default_cta text,
  contact_email text,
  contact_phone text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
```

## Initial seed

Insert one default row:

```sql
insert into workspace_settings (
  workspace_id,
  company_name,
  primary_city,
  response_time_target,
  default_cta,
  contact_email,
  contact_phone
) values (
  'default',
  'Proffera Demo AB',
  'Stockholm',
  'Under 10 minuter',
  'Boka demo',
  'hej@proffera.se',
  ''
)
on conflict (workspace_id) do nothing;
```

## Proposed UI scope

Update `/dashboard/installningar` from static preview to controlled settings page.

Show read data from `workspace_settings`.

Add a form with:

- Intern åtkomstkod
- Företagsnamn
- Primär ort
- Svarstid mål
- Standard CTA
- Kontakt e-post
- Kontakt telefon
- Spara inställningar

## Write behavior

On submit:

- Require internal access code.
- Validate field lengths.
- Update only `workspace_settings` for `workspace_id = 'default'`.
- Set `updated_at = now()`.
- Redirect to `/dashboard/installningar?updated=1`.

## Safety boundaries

This phase must not modify:

- customers
- bookings
- customer_events
- quote_requests
- company_registrations
- lead_outbox
- lead matching
- admin delivery flow
- email delivery
- public pages

This phase should only affect:

- new table `workspace_settings`
- `/dashboard/installningar`
- optional dashboard helper for reading/updating workspace settings

## Validation rules

Suggested limits:

- company_name max 160 characters
- primary_city max 120 characters
- response_time_target max 120 characters
- default_cta max 80 characters
- contact_email max 180 characters
- contact_phone max 80 characters

Required fields:

- company_name
- primary_city

Optional fields:

- response_time_target
- default_cta
- contact_email
- contact_phone

## Test plan

1. Run migration and seed default settings row in Neon.
2. Verify `/dashboard/installningar` renders real settings from Neon.
3. Update fields with test values:
   - company_name: `Proffera Demo AB Test`
   - primary_city: `Stockholm Test`
4. Verify success message.
5. Refresh page and confirm values persist.
6. Roll back to baseline values.
7. Confirm no other dashboard module changed.

## Rollback SQL

```sql
update workspace_settings
set
  company_name = 'Proffera Demo AB',
  primary_city = 'Stockholm',
  response_time_target = 'Under 10 minuter',
  default_cta = 'Boka demo',
  contact_email = 'hej@proffera.se',
  contact_phone = '',
  updated_at = now()
where workspace_id = 'default';
```

## Acceptance criteria

Phase 18.15 can be accepted only when:

- Settings migration is reviewed before running.
- `/dashboard/installningar` reads real settings from Neon.
- Settings form saves with correct internal access code.
- Values persist after refresh.
- Rollback restores baseline values.
- No customer, booking, event, lead, matching, outbox, admin or public page workflow is changed.

## Final decision

Proceed with implementation only after this plan is accepted.
