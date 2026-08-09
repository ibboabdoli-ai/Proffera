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

`seed` is the first-pilot mode. It accepts only explicit ten-digit organisation numbers from `COMPANY_DIRECTORY_SEED_ORGANIZATION_NUMBERS`. The Super Admin `Källtest` then verifies those records against the official detail API and writes nothing to Company Directory tables.

For seed mode, Proffera refuses to run the Källtest until all of these are explicit:

- test OAuth credentials;
- official detail URL;
- HTTP method;
- documented POST body template when the operation uses POST.

Proffera does not guess an official endpoint or request body.

`feed` is reserved for broad discovery after the exact official/reusable free downloadable-file or feed URL and format have been verified. The paid Företagsinformation API must never be configured as the discovery feed.

## Pilot area

Automatic/public pilot eligibility is limited to:

- Stockholm
- Södertälje

This is enforced twice:

1. application quality policy;
2. PostgreSQL publication constraint.

A company outside the pilot can be retained for review, but cannot become `published` while the pilot guard exists.

## Initial SNI2025 scope

Supported pilot categories are deliberately narrow and deterministic:

- `81.210` → Städning / lokalvård;
- `81.22*` → Städning / specialiserad rengöring, including fönsterputs;
- `96.910` → Hemservice. This broader household-service code is intentionally kept separate from the Städning category and does not auto-infer detailed service slugs;
- `49.420` → Flytt;
- `43.210` → Elektriker;
- `43.22*` → VVS;
- `43.341` → Måleri;
- `43.320` → Snickeri;
- `81.300` → Trädgård.

SNI determines the broad directory category. It does not prove exact services, prices or availability.

## Migrations

The current additive migration chain is:

1. `20260809_0037_company_profile_engine_foundation.sql`
2. `20260809_0038_company_profile_engine_provenance.sql`
3. `20260809_0039_company_profile_claim_guard.sql`
4. `20260809_0040_company_profile_claim_reservation.sql`
5. `20260810_0041_company_profile_pilot_location_guard.sql`
6. `20260810_0042_company_profile_claim_reservation_lease.sql`

Rollback notes: `db/migrations/20260809_company_profile_engine_rollback_notes.md`.

## Data quality/publication gates

A company is not automatically publishable unless all required checks pass, including:

- active organisation;
- juridical person;
- supported SNI category;
- Stockholm/Södertälje pilot location;
- legal name and city present;
- quality threshold;
- no sole-trader privacy block.

Negative signals such as `Ej registrerad`, `Inte registrerad` and deregistration do not count as positive tax/registration evidence.

The engine does not invent exact services, prices, reviews, staff, opening hours or real-company images.

## Media

Unclaimed profiles may use a Proffera-generated category illustration labelled `Illustrationsbild`.

Generated category illustrations are cached and are not created through a paid image API. When the official category changes, an old generated category image is retired so the public illustration cannot silently represent the wrong category.

Owner/rights-confirmed media remains separate from generated fallback media.

## Sync cost controls

- one running sync per provider, acquired atomically at the database layer;
- stale sync lease recovery after 15 minutes;
- pilot hard cap of 20 source records per scheduled run;
- field provenance is written as one batched JSONB insert per company rather than one database round-trip per field;
- repeated provenance values are deduplicated;
- source timestamp is preserved when an upstream response temporarily omits it;
- scheduled route is a safe no-op unless sync is explicitly enabled and a source is configured.

## Admin tools

Super Admin only:

- `/admin/foretag/directory` — read-only engine status, quality queue and sync history;
- `/admin/foretag/directory/preview` — `Källtest`, displays discovery mode/seed count, reads up to five seed/feed records, normalizes/verifies them and writes nothing to Company Directory tables;
- `/admin/foretag/claims` — claim verification, provisioning status and stale-reservation recovery.

Direct URLs have an explicit Super Admin route guard. The ordinary company-admin view does not expose the engine/claim controls.

## Claim/provisioning safety

Claim submission never grants ownership and is accepted only for profiles already in `published`, privacy-safe, eligible state.

Approval requires a Super Admin and verified claimant email. Provisioning uses the existing Proffera `provisionWorkspace` path.

Concurrency/recovery protections:

- per-profile claim reservation;
- unique operation token for each approval attempt;
- deterministic/reused requested Workspace ID on retry;
- a second click or competing claim cannot provision concurrently;
- the same claim may reacquire only after a 15-minute stale lease;
- stale reservation release is refused when the reserved Workspace already exists;
- claim decisions and stale recovery are audit logged.

## SEO

Only profiles already in `published` state and passing privacy/eligibility guards enter the platform sitemap.

Published directory pages use canonical metadata and factual LocalBusiness structured data without fake ratings, reviews, prices, phone numbers or service claims. Generated category images are not represented as actual-business media in structured data.

`ready`, `review`, `blocked` and `inactive` records are not exposed to search engines through the sitemap. Claim pages are `noindex`.

## Validation already completed

CI on the implementation branch validates dependency install, lint, TypeScript, Vitest, production build and whitespace. Tests cover source parsing, negative registration signals, SNI policy, pilot-location guards, zero-cost caps, seed configuration, public-claim publication guards, Super Admin route guards and claim-lease contracts.

Isolated Neon testing has verified:

- invalid/inactive profiles cannot publish;
- valid pilot profiles can publish;
- unknown-rights media cannot publish;
- generated rights-safe media can publish;
- Södertälje passes the pilot database guard while Malmö is rejected;
- competing claims cannot both acquire a profile reservation;
- active double-clicks on the same claim do not acquire a second operation token;
- the same claim can reacquire after the stale lease;
- stale recovery is refused if the reserved Workspace already exists.

All temporary Neon validation branches were deleted without applying Company Profile Engine migrations to the parent/main database.

## Real-data activation sequence

The free Bolagsverket access request has been submitted. When credentials arrive:

1. configure **test** OAuth + the exact official detail operation URL/method/body schema in a non-Production environment;
2. add a handful of known test organisation numbers to seed mode;
3. keep sync and auto-publish off;
4. open `/admin/foretag/directory/preview` and run the five-record read-only `Källtest`;
5. compare every normalized field with the official source response;
6. confirm the official downloadable discovery source URL/format before broad discovery;
7. create a fresh isolated Neon branch and apply migrations `0037`–`0042`;
8. run a very small ready-only Stockholm/Södertälje sync after the broad discovery adapter is verified;
9. inspect the Directory Admin queue and duplicate/media/privacy behavior;
10. only after evidence is reviewed, plan Production migration/deploy while auto-publish remains false;
11. enable automatic publication separately and explicitly.

## Current release gate

Until the real-data pilot is complete:

- PR remains Draft;
- no Company Profile Engine migration goes to the Neon main branch;
- no Production deploy;
- sync stays disabled;
- auto-publication stays disabled.
