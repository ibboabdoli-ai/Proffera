# Proffera Company Profile Engine

Status: implementation branch only. Not approved for Production rollout until the database migrations, official source integration, CI, Preview and pilot data have been verified.

## Goal

Continuously build high-quality public profiles for relevant Swedish service companies without inventing facts or silently copying third-party content.

The engine is deliberately fail-closed:

- official facts may be imported automatically;
- inferred categories are deterministic and traceable to SNI;
- uncertain or privacy-sensitive records are not auto-published;
- photos with unknown rights are not published;
- a public profile cannot become a customer Workspace until a claim is verified;
- approved claims reuse the existing Proffera Workspace provisioning path.

## Cost policy

The first production path must not require a new paid data service.

Allowed core sources/infrastructure:

- Bolagsverket/SCB `Värdefulla datamängder` because the official dataset is provided without a data fee;
- the free downloadable version of the same high-value dataset when it is operationally preferable for discovery;
- Proffera's existing Neon database and Vercel deployment/cron capacity, subject to the limits of the plans already in use;
- Proffera-owned/generated category illustrations.

Not allowed as a dependency of the core directory engine:

- the paid Bolagsverket `Företagsinformation` API;
- paid lead/company databases;
- paid image scraping/enrichment services;
- per-profile AI image generation;
- Google/third-party content copied into Proffera without a compliant license and storage policy.

If an optional paid enrichment is ever introduced, it must be feature-gated and the free official-data path must continue to work without it.

## Data flow

```text
Official discovery source
        ↓
Normalize company record
        ↓
Optional official detail verification by organisationsnummer
        ↓
SNI mapping + legal-form/privacy classification
        ↓
Quality score + publication gate
        ↓
Directory profile + field provenance
        ↓
Rights-aware media selection
        ↓
Public unclaimed profile
        ↓
Owner claim request
        ↓
Super Admin verification
        ↓
Atomic claim reservation
        ↓
Existing Proffera Workspace provisioning
        ↓
Claimed profile redirects to tenant public business page
```

## Source strategy

Preferred Swedish source: Bolagsverket/SCB `Värdefulla datamängder`.

Bolagsverket and SCB publish this high-value company information through an API and as downloadable files. The Proffera core path must use those no-data-fee sources rather than the separate paid `Företagsinformation` API.

The engine supports two source stages:

1. `COMPANY_DIRECTORY_SOURCE_URL` — discovery feed containing reusable official company records. During the pilot this stays explicitly configured rather than guessed.
2. `COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE` — second-stage official verification by organisation number using the high-value dataset API.

The exact test/production URLs must be copied from the current Bolagsverket developer portal after the free credentials are issued. The repository intentionally does not hard-code an environment URL so test credentials cannot accidentally be sent to production or vice versa.

OAuth variables:

- `COMPANY_DIRECTORY_TOKEN_URL`
- `COMPANY_DIRECTORY_OAUTH_SCOPE` (default `vardefulla-datamangder:read`)
- `BOLAGSVERKET_CLIENT_ID`
- `BOLAGSVERKET_CLIENT_SECRET`

The organisation lookup uses POST so the organisation number is not placed in the URL. The default body template is:

`{"identitetsbeteckning":"{organizationNumber}"}`

The source adapter also accepts the official response shape where organisations are returned in an `organisationer` array and reads nested organisation identity, company name, SNI, activity-description, address and registration signals conservatively.

## Publication policy

A directory record cannot be published unless the database constraint and application quality gate both pass.

Current automatic gate:

- company is active;
- company is classified as a juridical person;
- no sole-trader privacy block;
- legal company name exists;
- city exists;
- SNI maps to a supported pilot category;
- quality score is at least 80/100.

`COMPANY_DIRECTORY_AUTO_PUBLISH` must stay `false` during source integration and pilot verification. With it disabled, eligible profiles stop at `ready`.

If the official source does not provide enough evidence that an organisation is active, the adapter does not assume active status. This intentionally lowers recall before it lowers accuracy.

## Quality score

Current deterministic score:

| Signal | Points |
| --- | ---: |
| Active organisation | 25 |
| Legal name | 15 |
| Juridical person | 15 |
| Supported SNI | 20 |
| City | 10 |
| Complete postal address | 5 |
| Official source | 5 |
| Confirmed tax/VAT signal | 5 |
| **Maximum** | **100** |

The score is not a review score and must never be presented as a customer rating.

## Initial SNI mapping

The first pilot is deliberately narrow:

- `81.210` → Städning
- `81.22*` → Städning / fönsterputs-related cleaning
- `49.420` → Flytt
- `43.210` → Elektriker
- `43.22*` → VVS
- `43.341` → Måleri
- `43.320` → Snickeri
- `81.300` → Trädgård

SNI suggests a category. It does **not** prove every detailed service offered by the company. Suggested service slugs are therefore retained as suggestions and are not automatically published as factual price/service claims.

## Privacy policy

The first rollout does not automatically publish sole traders / enskild näringsverksamhet. Their organisation identifiers and address data can overlap with personal data, so the engine marks those records `privacy_blocked` until a dedicated legal/privacy workflow is approved.

The public imported profile does not expose the organisation number.

Field provenance stores a hash of the observed value plus source metadata rather than a second full copy of the upstream payload.

## Media policy

A profile image must have an explicit rights state.

Allowed published media rights:

- `owner_confirmed` — uploaded/confirmed by the verified business owner;
- `licensed` — obtained from a partner/source with a reusable license;
- `generated` — Proffera-owned/generated category illustration.

Unknown-rights external photos cannot be published due to the database constraint.

Until real business media is available, Proffera generates a branded category illustration. The public page labels it `Illustrationsbild` and explicitly states that it does not show the business's real premises or work.

Do not mass-copy Google Places photos/reviews into the directory database. If a future Places integration is added, follow the provider's current storage, attribution and content-use requirements.

## Claim workflow

Public profile:

```text
Äger du företaget?
→ authenticated claim request
→ rate limit
→ pending claim
```

A pending claim grants no permissions.

Super Admin route:

`/admin/foretag/claims`

The admin must record verification evidence. Approval requires the claimant's Proffera email to already be verified. The approval path then:

1. atomically reserves the directory profile to the exact claim;
2. reserves/reuses the Workspace UUID on that claim;
3. invokes the existing idempotent `provisionWorkspace` function;
4. creates/updates the claimant as Workspace owner;
5. creates the normal 14-day starter trial and default Workspace configuration;
6. copies the official activity description into the new Workspace intro only when the intro is empty;
7. finalizes the profile only if the same claim still owns the reservation;
8. clears the reservation and links the directory profile to the Workspace;
9. records the admin decision in `admin_audit_logs`;
10. changes the directory record and claim to `claimed`.

A different claim for the same profile cannot pass the atomic reservation update. Retrying the same claim is allowed, which keeps the flow recoverable/idempotent.

A claim that already owns the reservation cannot be rejected mid-provisioning.

The original imported URL redirects to `/foretag/<workspace-slug>` after claim so external links do not become dead ends.

## Scheduler

Vercel Cron path:

`/api/cron/company-directory-sync`

Schedule:

`17 2 * * *`

The route requires `Authorization: Bearer <CRON_SECRET>`.

Concurrency protections:

- one running sync per provider;
- stale running leases older than 15 minutes are marked failed before a new run starts;
- source cursor is stored in completed sync runs;
- profile upsert is unique by country + organisation number;
- provenance values are deduplicated by profile + field + source + value hash;
- profile claim provisioning is reserved by one claim at a time.

## Required rollout sequence

### 1. Local/CI source validation

- verify SNI/legal-form normalization against fixture data;
- lint;
- TypeScript typecheck;
- Vitest;
- production build.

### 2. Isolated Neon branch

Apply only the new additive migrations:

- `20260809_0037_company_profile_engine_foundation.sql`
- `20260809_0038_company_profile_engine_provenance.sql`
- `20260809_0039_company_profile_claim_guard.sql`
- `20260809_0040_company_profile_claim_reservation.sql`

Then verify constraints, indexes, publication/media guards and the two-claim reservation race before loading real pilot records.

### 3. Bolagsverket test environment

- request the no-data-fee `Värdefulla datamängder` API access;
- configure the issued test OAuth values;
- copy the current test operation/token URLs from the official developer portal;
- keep `COMPANY_DIRECTORY_AUTO_PUBLISH=false`;
- run a small sync;
- compare every normalized field against the official source response.

### 4. Pilot dataset

Start with a controlled Stockholm/Södertälje sample and the initial service categories only.

Acceptance gate before any auto-publish:

- no sole traders published;
- no inactive companies published;
- no unsupported SNI published;
- no duplicate organisation records;
- no real-business image shown without confirmed rights;
- no false services/prices generated;
- source/update information visible;
- claim cannot grant access without admin verification;
- competing claims cannot both provision a Workspace;
- retry of the same reserved claim remains safe;
- claimed profile resolves to the correct tenant Workspace.

### 5. Production activation

Only after the Preview/pilot evidence is reviewed:

1. apply migrations with branch-first production workflow;
2. configure Production Bolagsverket high-value-dataset credentials/endpoints;
3. deploy while `COMPANY_DIRECTORY_AUTO_PUBLISH=false`;
4. run a read-only/ready-only production sync;
5. inspect the ready queue;
6. explicitly approve auto-publication only if the sample passes the acceptance gate.

## Known deliberate limits

The engine cannot guarantee that an unclaimed company's marketing photos, exact prices, detailed services, opening hours or staff roster are correct unless a reusable authoritative source provides those fields. It therefore does not invent them.

This is a correctness feature, not missing enrichment: official facts are automated; marketing facts become owner-confirmed after claim or licensed/verified enrichment later.

The current free official API lookup is organisation-number driven. Automatic broad discovery must therefore use an official reusable discovery/bulk source, not brute-force organisation-number guessing. The high-value dataset is also offered as downloadable files; the exact production ingestion format/URL must be verified before enabling scheduled bulk discovery.

## Rollback

See `db/migrations/20260809_company_profile_engine_rollback_notes.md`.
