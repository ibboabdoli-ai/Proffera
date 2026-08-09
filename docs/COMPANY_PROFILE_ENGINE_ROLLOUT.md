# Company Profile Engine rollout

Current scope: implementation branch only. Do not merge or migrate Production before the free Bolagsverket real-data pilot passes.

## Core zero-extra-cost rule

The Company Profile Engine must not require a new paid data, image, enrichment or lead service.

Allowed core dependencies:

- Bolagsverket/SCB Värdefulla datamängder (official no-data-fee source);
- verified official downloadable high-value dataset for broad discovery when its exact reusable URL/format is confirmed;
- existing Proffera Neon/Vercel capacity;
- Proffera-owned/generated category illustrations.

Not allowed in the core path:

- paid Bolagsverket Företagsinformation API;
- paid company/lead databases;
- paid per-profile image generation/enrichment;
- copied Google/third-party photos or reviews without reusable rights.

## Safety defaults

```text
COMPANY_DIRECTORY_SYNC_ENABLED=false
COMPANY_DIRECTORY_AUTO_PUBLISH=false
COMPANY_DIRECTORY_DISCOVERY_MODE=seed
COMPANY_DIRECTORY_BATCH_SIZE=10
COMPANY_DIRECTORY_MAX_PAGES_PER_RUN=2
```

The application hard-caps the pilot at 10 source records per page and 2 pages per run even if environment values are accidentally larger.

## Pilot discovery modes

`seed` is the first-pilot mode. It accepts only explicit ten-digit organisation numbers from `COMPANY_DIRECTORY_SEED_ORGANIZATION_NUMBERS`. The Super Admin `Källtest` verifies those records against the official detail API and writes nothing to Company Directory tables.

Seed Källtest refuses to run until test OAuth credentials, the official detail operation URL/method and any documented POST request-body template are explicitly configured. Proffera does not guess an official endpoint or request body.

`feed` is reserved for broad discovery after the exact official/reusable free downloadable-file or feed URL and format have been verified. The paid Företagsinformation API must never be configured as the discovery feed.

## Pilot area

Automatic/public pilot eligibility is limited to Stockholm and Södertälje. This is enforced both in application policy and by a PostgreSQL publication constraint. A company outside the pilot can be retained for review but cannot become `published` while the pilot guard exists.

## Initial SNI2025 scope

- `81.210` → Städning / lokalvård;
- `81.22*` → Städning / specialiserad rengöring, including fönsterputs;
- `96.910` → Hemservice; intentionally distinct from Städning and without inferred detailed service slugs;
- `49.420` → Flytt;
- `43.210` → Elektriker;
- `43.22*` → VVS;
- `43.341` → Måleri;
- `43.320` → Snickeri;
- `81.300` → Trädgård.

SNI determines only the broad directory category. It does not prove exact services, prices or availability.

## Migrations

1. `20260809_0037_company_profile_engine_foundation.sql`
2. `20260809_0038_company_profile_engine_provenance.sql`
3. `20260809_0039_company_profile_claim_guard.sql`
4. `20260809_0040_company_profile_claim_reservation.sql`
5. `20260810_0041_company_profile_pilot_location_guard.sql`
6. `20260810_0042_company_profile_claim_reservation_lease.sql`

Rollback notes: `db/migrations/20260809_company_profile_engine_rollback_notes.md`.

## Data quality and media

Automatic publication requires an active juridical person, supported SNI, pilot location, required identity/location fields, sufficient quality score and no privacy block. Negative signals such as `Ej registrerad`, `Inte registrerad` and deregistration are not treated as positive evidence.

The engine does not invent exact services, prices, reviews, staff, opening hours or real-company images. Unclaimed profiles may use cached Proffera-generated category illustrations labelled `Illustrationsbild`. Unknown-rights external media cannot publish. If a generated category changes, the stale generated image is retired instead of silently remaining primary.

## Sync cost controls

- one running sync per provider, acquired atomically;
- stale sync lease recovery after 15 minutes;
- hard cap of 20 source records per scheduled pilot run;
- field provenance batched into one JSONB insert per company instead of one round-trip per field;
- repeated provenance values deduplicated;
- source timestamp preserved when an upstream response temporarily omits it;
- scheduled route safely no-ops unless sync is explicitly enabled and a source is configured.

## Admin tools

Super Admin only:

- `/admin/foretag/directory` — read-only engine status, quality queue and sync history;
- `/admin/foretag/directory/preview` — `Källtest`; shows discovery mode/seed count, reads up to five source records, normalizes/verifies them and writes nothing to Company Directory tables;
- `/admin/foretag/claims` — claim verification, provisioning status and stale-reservation recovery.

Direct URLs use explicit Super Admin guards. Ordinary company admins do not see or access these engine controls.

## Claim and provisioning safety

Public claims are accepted only for already-published, privacy-safe, eligible profiles. Claim submission never grants ownership.

Approval requires Super Admin review and verified claimant email and reuses the existing Proffera `provisionWorkspace` path. Safety includes per-profile reservations, a unique operation token per approval attempt, a stable requested Workspace ID for retries, rejection of second clicks/competing claims during an active lease, same-claim recovery only after 15 minutes, stale-release refusal when the reserved Workspace already exists, and audit logging.

## SEO

Only published, privacy-safe, eligible profiles enter the sitemap. Public directory pages use canonical metadata and factual LocalBusiness structured data without fake ratings, reviews, prices, phone numbers or service claims. Generated illustrations are not represented as actual-business media. Claim pages are `noindex`.

## Validation completed

CI validates dependency install, lint, TypeScript, Vitest, production build and whitespace. Tests cover source parsing, negative registration signals, SNI policy, pilot-location guards, zero-cost caps, seed configuration, public-claim guards, Super Admin route guards and claim-lease contracts.

Isolated Neon tests verified publication/media guards, Södertälje-vs-Malmö pilot enforcement, competing-claim exclusion, same-claim stale recovery, reservation pair integrity and refusal to release a stale reservation when its Workspace already exists. Temporary Neon validation branches were deleted without applying Company Profile Engine migrations to the parent/main database.

## Real-data activation sequence

The free Bolagsverket access request has been submitted. When credentials arrive:

1. configure **test** OAuth plus the exact official detail operation URL/method/body schema in a non-Production environment;
2. add a handful of known test organisation numbers in seed mode;
3. keep sync and auto-publish off;
4. run the five-record read-only `Källtest` and compare every normalized field with the official response;
5. confirm the official downloadable discovery source URL/format before broad discovery;
6. create a fresh isolated Neon branch and apply migrations `0037`–`0042`;
7. run a very small ready-only Stockholm/Södertälje sync after discovery is verified;
8. inspect duplicate/media/privacy/claim behavior in Admin;
9. only after evidence review, plan Production migration/deploy while auto-publish remains false;
10. enable automatic publication separately and explicitly.

## Current release gate

Until the real-data pilot is complete:

- PR remains Draft;
- no Company Profile Engine migration goes to the Neon main branch;
- no Production deploy;
- sync stays disabled;
- auto-publication stays disabled.
