# Company Profile Engine rollout

Current scope: implementation branch + isolated Preview/Neon pilot only. Do not merge or migrate Production before the final Preview review is explicitly approved.

## Core zero-extra-cost rule

The Company Profile Engine must not require a new paid data, image, enrichment or lead service.

Allowed core dependencies:

- SCB/Bolagsverket `Värdefulla datamängder` (official no-data-fee source);
- the official SCB HVD bulk ZIP for broad discovery;
- Bolagsverket HVD `/organisationer` for official detail verification;
- data.europa.eu metadata only to locate the current official SCB distribution when an explicit URL is not configured;
- existing Proffera Neon/Vercel/GitHub capacity;
- Proffera-owned/generated category illustrations.

Not allowed in the core path:

- paid Bolagsverket `Företagsinformation` API;
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

Automatic discovery, sync and publication are separate switches. Moving discovery to `automatic` does not itself publish anything. The isolated pilot enables discovery/sync only in Preview and keeps `COMPANY_DIRECTORY_AUTO_PUBLISH=false`.

## Discovery modes

`seed` is the safe integration-test mode for documented TEST identities.

`feed` is compatibility mode for a verified JSON feed with cursor pagination.

`automatic` is the target operational mode:

```text
Official SCB HVD bulk ZIP
→ primary SNI (Ng1) + JurForm + Stockholm/Södertälje discovery filter
→ durable discovery queue
→ official Bolagsverket /organisationer verification
→ normalization + privacy/quality policy
→ directory profile + provenance + rights-safe media
→ ready/review/blocked/inactive
→ optional publication only when the separate auto-publish switch is enabled
```

### Official bulk source

Current data.europa.eu resource:

```text
https-metadata-bolagsverket-se-store-2-resource-76
```

Current official discovery distribution:

```text
https://vardefulla-datamangder.bolagsverket.se/scb/scb_bulkfil.zip
```

The worker accepts only the exact official SCB HVD ZIP path on `bolagsverket.se`. It uses verified HTTP Range segments, validates the expected byte ranges and final size, verifies the ZIP, and records a SHA-256 source fingerprint. This avoids the silent truncation observed with one long streaming download.

Raw SCB bulk rows are never posted to Proffera or stored in Neon. Only official organisation identifiers that pass the discovery prefilter are enqueued.

## Discovery precision

SCB `PeOrgNr` is normalized from `16` + ten-digit Swedish organisation number to the ten-digit identifier expected by Bolagsverket `/organisationer`.

The production-target worker uses:

- `Ng1` only as the primary/`huvudnäringsgren` SNI signal;
- `PostOrt` for the pilot-area discovery prefilter;
- `JurForm` to limit automatic discovery to supported registered organisation forms;
- legal-form priority so ordinary Swedish companies are considered before foreign branches.

`Ng2`–`Ng5` are secondary activities and do not make a company discoverable. This rule was added after a real pilot showed that secondary-SNI matching admitted companies whose actual primary business was parking, property management, accounting or other unrelated activity.

The first rollout blocks sole traders from automatic publication. Registered `Filial` organisations are not treated as personal/sole-trader data, but ordinary Swedish company forms are prioritized ahead of them for discovery.

## Pilot area

Automatic/public pilot eligibility is limited to Stockholm and Södertälje. Discovery uses the SCB location as a prefilter; Bolagsverket detail verification is authoritative before profile assessment. If verified detail resolves outside the pilot area, the profile remains review-only and cannot publish.

## Initial SNI2025 scope

- `81.210` → Städning / lokalvård;
- `81.221` → Städning / building cleaning, including specialist building cleaning/fönsterputs;
- `96.910` → Hemservice; intentionally distinct from Städning and without inferred detailed service slugs;
- `49.420` → Flytt;
- `43.210` → Elektriker;
- `43.22*` → VVS/installationsarbete for the current first rollout;
- `43.341` → Måleri;
- `43.320` → Snickeri;
- `81.300` → Trädgård.

`81.222` (Skorstensfejarverksamhet) is deliberately not mapped to Städning in this rollout.

SNI determines only the broad directory category. It does not prove exact services, prices or availability.

## Detail verification and activity status

Every discovered organisation is verified through Bolagsverket HVD `/organisationer` before a profile write.

The HVD detail dataset provides the aggregate `verksamOrganisation` activity signal. Individual F-tax/VAT/employer fields are not required for quality scoring when they are absent from this HVD response; an active verified HVD organisation is treated as satisfying the available registration-quality signal. Explicit negative registration information, when present, remains fail-closed.

## Durable queue

The queue is persistent and idempotent. It uses:

- atomic `FOR UPDATE SKIP LOCKED` claims;
- per-item processing leases;
- stale-lease recovery;
- bounded retries and exponential retry delay;
- source fingerprinting for changed official snapshots;
- protected already-claimed profiles.

Transient Bolagsverket timeouts were exercised in the real pilot and recovered on retry without publishing or losing the queue item.

## Automatic scheduler

`.github/workflows/company-directory-automation.yml` provides two independent jobs:

- daily discovery from the official SCB HVD distribution;
- frequent small queue-processing runs that verify candidates and build/update profiles.

The workflow reuses the protected Proffera cron origin/secret pattern. Before downloading the bulk file, it probes the authenticated discovery endpoint and exits before download when automatic sync is disabled.

Scheduled operation remains inert while this implementation exists only on the feature branch. Do not merge merely to activate schedules.

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

Automatic publication requires an active juridical organisation, supported primary SNI, pilot location, required identity/location fields, sufficient quality score and no privacy block.

The engine does not invent exact services, prices, reviews, staff, opening hours or real-company images. Unclaimed profiles may use Proffera-generated category illustrations labelled `Illustrationsbild`. Unknown-rights external media cannot publish. Generated category media is recorded with generated-license provenance and is never represented as actual business photography.

## Admin tools

Super Admin only:

- `/admin/foretag/directory` — engine status, quality queue and sync history;
- `/admin/foretag/directory/preview` — read-only Källtest;
- `/admin/foretag/directory/auto-scan` — Preview-only TEST scan;
- `/admin/foretag/claims` — claim verification, provisioning status and stale-reservation recovery.

The automatic engine does not depend on an Admin page being open and does not require manual organisation-number entry.

## Claim and provisioning safety

Public claims are accepted only for already-published, privacy-safe, eligible profiles. Claim submission never grants ownership.

Workspace ownership is granted only after claimant verification and reuses the existing `provisionWorkspace` source of truth. Claim reservation/token/lease guards prevent double provisioning and competing claims.

Company discovery/profile creation may be automated. Company ownership must remain verified.

## SEO

Only published, privacy-safe, eligible profiles enter the sitemap. Public directory pages use canonical metadata and factual LocalBusiness structured data without fake ratings, reviews, prices, phone numbers or service claims. Generated illustrations are not represented as actual-business media. Claim pages are `noindex`.

## Validation completed

Official Bolagsverket TEST validation completed before the real-data pilot:

- OAuth token: OK;
- `/isalive`: OK;
- `/organisationer`: OK;
- documented TEST identities scanned without weakening policy.

### Real-data isolated pilot

The real-data path was executed only against a Preview deployment connected to isolated Neon branch `br-twilight-queen-adwl0qn8`. Production/Main were not changed and auto-publication remained off.

Evidence gathered across successive hardening passes:

1. Initial discovery proved SCB bulk download, queue ingestion and Bolagsverket Production detail verification end-to-end. It exposed over-broad legal-form/SNI selection.
2. `JurForm` filtering/prioritization produced a 20-company batch consisting entirely of `Aktiebolag`; 12 were immediately eligible, 2 verified inactive and 6 exposed secondary-SNI/location precision issues.
3. Restricting discovery to official primary SNI `Ng1` removed the secondary-SNI false positives. The next run added six replacement active `Aktiebolag` with matching verified primary industries.
4. The same run exposed `81.222` chimney sweeping as distinct from `81.221` building cleaning; the mapping and worker scope were tightened accordingly.
5. A transient Bolagsverket timeout was safely retried to completion.

At the end of the Ng1 pilot before historical-row cleanup/reassessment, the isolated database contained 46 verified profiles/queue rows, zero failed queue items and **zero published profiles**. Historical rows from earlier deliberately broader pilot passes remain in the isolated branch for audit evidence and are not evidence of the final discovery filter.

Provenance and generated-category media were also checked: official detail fields carry source provenance and generated illustrations remain rights-safe/non-business media.

## Final release gate

The real-data pilot now proves the core discovery/verification/queue/profile path. Before any Production change:

1. keep PR #440 Draft;
2. run full CI after final cleanup;
3. deploy one final Preview containing the latest Ng1, SNI-boundary and quality-policy code;
4. re-evaluate a small canary set and confirm `COMPANY_DIRECTORY_AUTO_PUBLISH=false` still yields zero published profiles;
5. remove/keep removed all temporary pilot/probe workflows and trigger markers;
6. review PR diff and migration plan;
7. only then explicitly decide whether to apply migrations `0037`–`0043` to Production/Main;
8. if Production rollout is approved, keep auto-publication false through initial production sync observation;
9. enable automatic publication only as a separate final explicit decision.

Until those steps are explicitly approved:

- PR remains Draft;
- no Company Profile Engine migration goes to Neon main;
- no Production deploy/promotion;
- Production sync stays unchanged;
- automatic publication stays disabled.
