# P22F — Workspace schema plan

Status: Planned / docs-only
Date: 2026-06-16

## Purpose

Define the Proffera-owned workspace and access-control schema that will sit on top of Better Auth.

P22F is a planning phase only. It must not add SQL migrations, auth routes, login behavior, dashboard query changes, or production data changes.

## Current foundation

- P22D added Better Auth dependencies and lazy `getAuth()` setup.
- P22E added a Better Auth core schema migration candidate for identity/session tables only.
- Temporary dashboard Basic Auth remains active.
- Existing dashboard data still uses the current workspace model and must not be migrated in this phase.

## Separation of responsibility

### Better Auth owns

- User identity
- Sessions
- OAuth/email-password accounts
- Verification tokens

### Proffera owns

- Workspaces / customer companies
- Workspace memberships
- Roles and permissions
- Plan/subscription access state
- Business data ownership and authorization boundaries
- CRM, leads, bookings, settings, services, customer events

## Proposed Proffera tables

### `workspaces`

Purpose: one customer company/account inside Proffera.

Suggested columns:

- `id` uuid primary key
- `slug` text unique not null
- `name` text not null
- `company_name` text
- `primary_city` text
- `contact_email` text
- `contact_phone` text
- `status` text not null default `'active'`
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Initial statuses:

- `active`
- `trial`
- `paused`
- `cancelled`

### `workspace_memberships`

Purpose: connect Better Auth users to Proffera workspaces.

Suggested columns:

- `id` uuid primary key
- `workspace_id` uuid not null references `workspaces` (`id`) on delete cascade
- `user_id` text not null references `user` (`id`) on delete cascade
- `role` text not null default `'owner'`
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Suggested constraints:

- unique (`workspace_id`, `user_id`)

Initial roles:

- `owner`
- `admin`
- `staff`
- `viewer`

### `workspace_plans`

Purpose: store Proffera plan/access state independently from Stripe/payment implementation.

Suggested columns:

- `id` uuid primary key
- `workspace_id` uuid not null references `workspaces` (`id`) on delete cascade
- `plan_key` text not null
- `status` text not null default `'trialing'`
- `current_period_start` timestamptz
- `current_period_end` timestamptz
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Initial plan keys:

- `starter`
- `professional`
- `business`

Initial plan statuses:

- `trialing`
- `active`
- `past_due`
- `cancelled`
- `paused`

### `workspace_feature_flags`

Purpose: gate features without hard-coding plan assumptions throughout the app.

Suggested columns:

- `id` uuid primary key
- `workspace_id` uuid not null references `workspaces` (`id`) on delete cascade
- `feature_key` text not null
- `enabled` boolean not null default false
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

Suggested constraints:

- unique (`workspace_id`, `feature_key`)

Initial feature keys:

- `ai_assistant`
- `chat_widget`
- `booking_demo`
- `crm_customers`
- `lead_inbox`

## Relationship to existing data

Existing tables currently use current project data patterns and may still contain `workspace_id = 'default'` or similar values.

P22F must not rewrite existing business data.

A later migration phase should decide how to map existing/default data into a real workspace safely.

## Non-goals

P22F must not:

- execute SQL against Neon
- create or alter runtime dashboard authorization
- connect `/logga-in` to Better Auth
- remove Basic Auth
- migrate existing CRM/booking data
- add Stripe or payment integration
- add Service AI Chat tenant creation logic
- change public website copy or layout

## Proposed implementation sequence

1. P22F — approve workspace schema plan.
2. P22G — add workspace schema migration file only.
3. P22H — add read-only workspace access helper, not wired to dashboard yet.
4. P22I — add real auth route skeleton.
5. P22J — connect login/session to a safe test-only page.
6. P22K — migrate or seed first Proffera workspace after explicit approval.
7. P22L — replace dashboard Basic Auth only after session and workspace authorization are verified.

## Acceptance criteria for P22F

- Plan exists in docs.
- No runtime code changes.
- No SQL migration file is added in this phase.
- No production data is modified.
- Next phase remains explicit and reviewable.
