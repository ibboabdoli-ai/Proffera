# Project Log

This file records what has been built and tested in Proffera.

## P24S — Customer note copy polish

Status: PR ready.

Details: `docs/logs/PHASE_P24S_CUSTOMER_NOTE_COPY_POLISH.md`

Built:

- Polished the `Kundprofil` summary copy for customer notes.
- Changed `Noteringar → Kan sparas` to `Noteringar → Intern notering` for clearer Swedish UI text.
- Kept the existing note form, access-code flow, customer history and database logic unchanged.
- No database, API, auth or migration changes were added.

Tested:

- GitHub diff review required.
- GitHub Actions CI should run on the PR.
- Local lint/build were not run because this execution mode has no local shell access.

## P24R — Booking customer meta polish

Status: PR ready.

Details: `docs/logs/PHASE_P24R_BOOKING_CUSTOMER_META_POLISH.md`

Built:

- Cleaned the linked customer meta row in `Bokningsprofil → Kopplad kund`.
- Removed repeated service text from the compact customer meta row.
- Kept the booking service visible in the booking details section.
- No database, API, auth or migration changes were added.

Tested:

- GitHub diff review required.
- GitHub Actions CI should run on the PR.
- Local lint/build were not run because this execution mode has no local shell access.

## P22D-prep — Local toolchain alignment

Status: done.

Details: `docs/logs/PHASE_P22D_PREP_TOOLCHAIN.md`

Built:

- Added `.nvmrc` with Node 22.
- Added `engines.node` requirement to `package.json`.
- Pinned `eslint` to `9.39.1` instead of `latest`.
- No Better Auth dependency, auth route, migration, login flow or dashboard logic was added.

Tested:

- Remote code inspection completed.
- Local verification still required after pulling latest main: `nvm use`, `npm install`, `npm run build`, `npm run lint`.

## P22C — Auth implementation decision

Status: done.

Details: `docs/PHASE_P22C_AUTH_IMPLEMENTATION_DECISION.md`

Built:

- Selected Better Auth with PostgreSQL/Neon as the planned authentication foundation.
- Confirmed Proffera should keep ownership of workspace, membership, role and business authorization tables.
- Compared Better Auth, Clerk, Supabase Auth and custom auth.
- No code, dependency or database migration was added in this decision step.

Tested:

- Official auth documentation was checked.
- Current `package.json` and existing Proffera stack were checked.

## P22B — Auth and workspace model plan

Status: done.

Details: `docs/PHASE_P22B_AUTH_WORKSPACE_MODEL_PLAN.md`

Built:

- Added a plan for real Proffera users, sessions, workspaces, workspace memberships and roles.
- Documented the rule that dashboard workspace access must come from trusted session membership, not from query params or hidden fields.
- Documented a safe additive migration path for future auth/workspace tables.
- No code, dependency or database migration was added in this planning step.

Tested:

- Confirmed `package.json` has no auth dependency.
- Confirmed middleware currently uses temporary dashboard protection.
- Confirmed the master plan requires session-derived workspace identity before real onboarding.

## P22A — Dashboard temporary Basic Auth
