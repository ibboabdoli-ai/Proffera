# Proffera Current Status

This file is the single source of truth for the current project state. Update it after every completed or materially changed phase.

Last updated: 2026-07-17

Active phase history is stored under `docs/logs/`. `docs/PROJECT_LOG.md` is a legacy/reference history file and is not required for normal phase updates.

## Current completed phases

- Phase 18.15: Workspace settings save/edit completed.
- Phase 18.16A: Services read-only completed.
- Phase 18.16B: Services create/edit completed and tested.
- Phase 18.17: Documentation sync completed.
- Phase 18.17B: Documentation workflow cleanup completed and merged through PR #12.
- Phase 18.17C: Documentation workflow hardening completed and merged through PR #17.
- P21: Proffera login entry foundation completed. Public `Logga in` now stays inside Proffera at `/logga-in`; no real auth was added.
- P22A: Temporary Basic Auth protection added for `/dashboard` and `/dashboard/*`; real customer auth is not implemented yet.
- P22B: Auth and workspace model plan added. No code or database changes were made in that planning step.
- P22C: Auth implementation direction selected: Better Auth with PostgreSQL/Neon, plus Proffera-owned workspace and membership tables.
- P22D retry plan added after dependency resolution conflict. No auth dependency was installed in that planning step.
- P22D-prep: Local toolchain alignment completed with `.nvmrc`, Node engine requirement and ESLint 9 pin.
- P22D-prep follow-up: ESLint config moved away from `FlatCompat` to direct flat config imports for Next/TypeScript.
- P22D-prep lint cleanup: demo booking ID generation made deterministic and local lint/build passed.
- P22D-retry: pinned Better Auth/PostgreSQL dependency attempt failed in Vercel and was rolled back from `main`. Real auth is still not active.
- PR #102: Homepage Swedish/product copy polish completed.
- PR #103: Customer profile created-confirmation message completed.
- PR #104: AI-assistent page copy adjusted to present the module as planned/preview instead of fully active.
- PR #105: Proffera gated automerge workflow merged on `main` for safe worker PRs.
- Lead → Booking → Customer activation flow is complete.
- Module registry with `Aktiv`, `Planerad`, and `Låst` status is in place.
- PR #159: Mobile public navigation closes after navigation, and the admin company overview lists real workspaces separately from incoming registrations.
- PR #160: Settings reads workspace module availability from `workspace_feature_flags`; existing active/trial workspaces received base booking and CRM feature flags.
- P92: Dashboard navigation and the Leads, Customers, and Bookings route trees enforce workspace module access. Production deployment passed.
- P93: Proffera admin can manage each workspace plan status and base booking/CRM module access. Local lint, TypeScript and production build passed.

## Production status

- `main` is the production branch.
- Proffera is deployed on `proffera.se` through Vercel production.
- Workspace settings save/edit and workspace services read/create/edit/active-inactive flows are deployed and verified.
- Dashboard service deletion remains intentionally unavailable.
- Existing public website, dashboard, CRM/booking, lead, matching, outbox, Brevo, and mailto flows must remain protected.
- `/logga-in` is now a Proffera-owned customer portal entry page, not a redirect to `chat.proffera.se`.
- `/dashboard` now has temporary Basic Auth protection.
- P22D direct `latest` dependency attempt failed during npm dependency resolution and was rolled back to keep install/build safe.
- P22D pinned dependency retry failed in Vercel and was rolled back from `main`.
- `src/lib/auth.ts` is currently a dependency-free placeholder; real customer auth is still not active.
- `.nvmrc` now requests Node 22 for local development.
- `package.json` now declares Node `>=20.9.0` and pins ESLint to v9.
- `eslint.config.mjs` now uses direct flat config imports instead of `FlatCompat`.
- Service AI Chat remains a separate project at `chat.proffera.se` and must not be merged into this repo.
- AI-assistent in the Proffera dashboard is currently planned/preview copy, not a fully active production integration.
- Workspace module status is read from Neon and displayed in Settings.
- Locked CRM or booking modules are non-interactive in dashboard navigation and blocked on direct route access.
- Normal worker branches should use the `work/proffera-` prefix.
- Worker PRs must target `main`, pass real non-self checks, avoid blocked sensitive paths, and require the `ibbo-approved` label before gated automerge can run.

## Recommended next step

Deploy P93 and verify one active workspace plus one paused test workspace from `/admin/foretag`. Then continue with durable customer authentication and roles. Do not add Stripe or activate the AI assistant yet.

Do not start a full Service AI Chat merge or broad cross-project refactor.

## Open risks

- Temporary dashboard protection is not a durable SaaS authorization model.
- Real customer authentication, sessions, roles, and workspace binding are not implemented yet.
- Sensitive access values must not appear in URLs, forms, screenshots, logs, or documentation.
- Continue auditing legacy `workspace_id = 'default'` profile fallbacks; CRM and booking writes already use the authenticated workspace.
- Public forms need server-side validation, rate limiting, and spam protection.
- Dashboard/private routes should not be indexed.
- Canonical URLs, robots rules, sitemap coverage, and mobile navigation need review.
- `Boka demo` should become a real booking/contact flow.
- MVP and placeholder copy should be replaced before real sales.
- Service AI Chat must keep Iboren and Proffera messages/leads strictly separated.
- `/logga-in` is only a portal entry placeholder; real customer authentication, session handling, roles, and workspace binding are not implemented yet.
- Plan and base module access are managed manually from Proffera admin; Stripe synchronization is not implemented.

## Protected flows

Do not break:

- Quote request flow.
- Company registration.
- Company approval and service editing.
- Lead/company matching.
- Outbox/delivery log and duplicate prevention.
- Brevo lead email sending.
- Manual mailto fallback.
- Existing Neon/Postgres persistence.

## Update rule

After each phase, follow [`DOCS_UPDATE_CHECKLIST.md`](DOCS_UPDATE_CHECKLIST.md) and add a concise phase log under `docs/logs/`.
