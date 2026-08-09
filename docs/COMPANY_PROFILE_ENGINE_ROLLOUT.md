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
COMPANY_DIRECTORY_BATCH_SIZE=10
COMPANY_DIRECTORY_MAX_PAGES_PER_RUN=2
```

The application hard-caps the pilot at 10 source records per page and 2 pages per run even if environment values are accidentally larger.

## Pilot area

Automatic/public pilot eligibility is limited to:

- Stockholm
- Södertälje

This is enforced twice:

1. application quality policy;
2. PostgreSQL publication constraint.

A company outside the pilot can be retained for review, but cannot become `published` while the pilot guard exists.

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
- `/admin/foretag/directory/preview` — `Källtest`, reads up to five source records, normalizes/verifies them and writes nothing to Company Directory tables;
- `/admin/foretag/claims` — claim verification, provisioning status and stale-reservation recovery.

The ordinary company-admin view does not expose the engine/claim controls.

## Claim/provisioning safety

Claim submission never grants ownership.

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

`ready`, `review`, `blocked` and `inactive` records are not exposed to search engines through the sitemap.

## Real-data activation sequence

When Bolagsverket sends the free credentials:

1. configure **test** OAuth + official operation URLs in a non-Production environment;
2. keep sync and auto-publish off;
3. open `/admin/foretag/directory/preview` and run the five-record read-only `Källtest`;
4. compare every normalized field with the official source response;
5. confirm official downloadable discovery source URL/format if used;
6. create a fresh isolated Neon branch and apply migrations `0037`–`0042`;
7. run a very small ready-only Stockholm/Södertälje sync;
8. inspect the Directory Admin queue and duplicate/media/privacy behavior;
9. only after evidence is reviewed, plan Production migration/deploy while auto-publish remains false;
10. enable automatic publication separately and explicitly.

## Current release gate

Until the real-data pilot is complete:

- PR remains Draft;
- no Company Profile Engine migration goes to the Neon main branch;
- no Production deploy;
- sync stays disabled;
- auto-publication stays disabled.
