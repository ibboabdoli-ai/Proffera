# Company Profile Engine rollout

Current scope: implementation branch only. Do not merge or migrate Production before the real-data Bolagsverket pilot passes.

## Core zero-extra-cost rule

The Company Profile Engine must not require a new paid data, image, enrichment or lead service.

Allowed core dependencies:

- Bolagsverket/SCB Värdefulla datamängder (official no-data-fee source);
- Bolagsverket's official downloadable high-value dataset for broad discovery;
- data.europa.eu metadata only to resolve the current official Bolagsverket distribution when an explicit URL is not configured;
- existing Proffera Neon/Vercel/GitHub capacity;
- Proffera-owned/generated category illustrations.

Not allowed in the core path:

- paid Bolagsverket Företagsinformation API;
- paid company/lead databases;
- guessed organisation numbers;
- paid per-profile image generation/enrichment;
- copied Google/third-party photos or reviews without reusable rights.

## Safety defaults

```text
COMPANY_DIRECTORY_SYNC_ENABLED=false
COMPANY_DIRECTORY_AUTO_PUBLISH=false
COMPANY_DIRECTORY_DISCOVERY_MODE=seed
COMPANY_DIRECTORY_BATCH_SIZE=10
COMPANY_DIRECTORY_MAX_PAGES_PER_RUN=2
COMPANY_DIRECTORY_QUEUE_BATCH_SIZE=15
```

Automatic discovery, sync and publication are separate switches. Moving discovery to `automatic` does not itself publish anything, and `COMPANY_DIRECTORY_SYNC_ENABLED=false` makes scheduler endpoints no-op.

## Discovery modes

`seed` is the safe integration-test mode. It accepts explicit documented TEST organisation numbers and the Super Admin `Källtest` writes nothing to Company Directory tables.

`feed` is compatibility mode for a verified JSON feed with cursor pagination.

`automatic` is the target production mode:

```text
Official Bolagsverket HVD bulk ZIP
→ scheduled discovery worker
→ Stockholm/Södertälje + supported-SNI prefilter
→ durable discovery queue
→ official /organisationer detail verification
→ normalization + policy
→ directory profile + provenance + rights-safe media
→ ready/review/blocked/inactive
→ optional publication only when the separate auto-publish switch is enabled
```

The bulk worker never invents organisation numbers. It accepts a final download only when the URL is HTTPS on `bolagsverket.se` or one of its subdomains. Raw bulk rows are not posted to Proffera; only official organisation identifiers that match the pilot-area/SNI prefilter are enqueued.

The queue is persistent and idempotent. It uses a per-item processing lease, `FOR UPDATE SKIP LOCKED`, stale-lease recovery, bounded retries and exponential retry delay. A source fingerprint re-queues changed official records while already-claimed companies remain protected.

## Automatic scheduler

`.github/workflows/company-directory-automation.yml` provides two independent jobs:

- daily discovery of candidates from the official bulk distribution;
- frequent small queue-processing runs that verify candidates against Bolagsverket and build/update profiles.

The workflow reuses the existing protected Proffera cron origin/secret pattern. Before downloading a bulk file, it probes the authenticated discovery endpoint. If automatic sync is disabled, it exits successfully before downloading anything.

This workflow is intentionally inert while it exists only on the implementation branch. Scheduled GitHub Actions run from the default branch after an approved merge; the backend still no-ops until automatic sync is explicitly enabled.

## Pilot area

Automatic/public pilot eligibility is limited to Stockholm and Södertälje. This is enforced by application policy and a PostgreSQL publication constraint. A company outside the pilot can be retained for review but cannot become `published` while the pilot guard exists.

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
7. `20260810_0043_company_profile_discovery_queue.sql`

Migration `0043` adds source-snapshot metadata and the durable discovery queue. Raw bulk files are not stored in Neon.

Rollback notes: `db/migrations/20260809_company_profile_engine_rollback_notes.md`.

## Data quality and media

Automatic publication requires an active juridical person, supported SNI, pilot location, required identity/location fields, sufficient quality score and no privacy block. Negative registration/deregistration signals are fail-closed.

The engine does not invent exact services, prices, reviews, staff, opening hours or real-company images. Unclaimed profiles may use cached Proffera-generated category illustrations labelled `Illustrationsbild`. Unknown-rights external media cannot publish. If a generated category changes, the stale generated image is retired.

## Sync and retry controls

- one running legacy sync per provider, acquired atomically;
- queue items claimed atomically with `FOR UPDATE SKIP LOCKED`;
- queue processing lease expires after 15 minutes;
- maximum five verification attempts before terminal `failed` state;
- exponential retry delay for transient candidate failures;
- maximum 20 queued candidates verified in one backend run;
- provenance values are batched and deduplicated;
- source timestamps are preserved when upstream temporarily omits them;
- all scheduled endpoints require `CRON_SECRET`;
- discovery ingest accepts only an official Bolagsverket HTTPS source URL.

## Admin tools

Super Admin only:

- `/admin/foretag/directory` — engine status, quality queue and sync history;
- `/admin/foretag/directory/preview` — read-only Källtest;
- `/admin/foretag/directory/auto-scan` — Preview-only scan of all documented Bolagsverket TEST identities;
- `/admin/foretag/claims` — claim verification, provisioning status and stale-reservation recovery.

The automatic production engine does not depend on any Admin page being open and does not require a human to enter organisation numbers.

## Claim and provisioning safety

Public claims are accepted only for already-published, privacy-safe, eligible profiles. Claim submission never grants ownership.

Claim approval remains deliberately separate from automatic company discovery. Workspace ownership is granted only after claimant verification and reuses the existing `provisionWorkspace` source of truth. Claim reservation/token/lease guards prevent double provisioning and competing claims.

This is the one area that must not be made unauthenticated simply to achieve zero-click directory creation. Company discovery/profile creation is automatic; company ownership must remain verified.

## SEO

Only published, privacy-safe, eligible profiles enter the sitemap. Public directory pages use canonical metadata and factual LocalBusiness structured data without fake ratings, reviews, prices, phone numbers or service claims. Generated illustrations are not represented as actual-business media. Claim pages are `noindex`.

## Validation already completed

The TEST OAuth flow, `/isalive`, `/organisationer`, normalization and policy engine have been exercised against official Bolagsverket TEST data. The documented TEST set contains no candidate that simultaneously matches the current pilot area and supported SNI set; that is a limitation of the TEST fixtures, not a reason to weaken policy.

Previous isolated Neon tests verified publication/media guards, Södertälje-vs-Malmö enforcement, competing-claim exclusion, stale recovery and reservation integrity without applying Company Profile Engine migrations to Neon main.

## Real-data activation sequence

Bolagsverket has issued both TEST and Production API access. Production credentials are not committed and must not be activated on this branch.

1. keep this PR Draft and run full CI for the automatic discovery implementation;
2. verify the current official bulk ZIP structure against `scripts/company-directory-discovery.py` in a non-Production run;
3. create a fresh isolated Neon branch and apply migrations `0037`–`0043` there only;
4. configure TEST/detail verification plus automatic discovery against the isolated Preview environment while keeping `COMPANY_DIRECTORY_AUTO_PUBLISH=false`;
5. run a small real-data Stockholm/Södertälje discovery and inspect normalized/profile/provenance results field-by-field;
6. inspect duplicate, privacy, media, retry and claim behavior;
7. only after evidence review, plan the Production migration/deploy with auto-publish still false;
8. configure Production Bolagsverket credentials privately and enable `COMPANY_DIRECTORY_DISCOVERY_MODE=automatic` plus `COMPANY_DIRECTORY_SYNC_ENABLED=true`;
9. observe several successful sync cycles;
10. enable automatic publication separately and explicitly only after that final review.

## Current release gate

Until the real-data pilot is complete:

- PR remains Draft;
- no Company Profile Engine migration goes to Neon main;
- no Production deploy/promotion;
- Production sync stays disabled;
- automatic publication stays disabled.
