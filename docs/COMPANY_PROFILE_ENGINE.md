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
Existing Proffera Workspace provisioning
        ↓
Claimed profile redirects to tenant public business page
```

## Source strategy

Preferred Swedish source: Bolagsverket/SCB Värdefulla datamängder.

The engine supports two source stages:

1. `COMPANY_DIRECTORY_SOURCE_URL` — a paginated JSON discovery feed containing reusable official company records.
2. `COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE` — optional second-stage official verification by organisation number.

The exact test/production endpoints and request body must be copied from the current provider Swagger after Proffera receives API access. The repository intentionally does not guess or hard-code an undocumented operation URL.

OAuth variables:

- `COMPANY_DIRECTORY_TOKEN_URL`
- `BOLAGSVERKET_CLIENT_ID`
- `BOLAGSVERKET_CLIENT_SECRET`

For a detail API that uses POST, set:

- `COMPANY_DIRECTORY_DETAIL_METHOD=POST`
- `COMPANY_DIRECTORY_DETAIL_BODY_TEMPLATE` to the JSON structure documented by the provider. `{organizationNumber}` is replaced with the ten-digit Swedish organisation number.

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

1. reserves a deterministic Workspace UUID on the claim;
2. invokes the existing `provisionWorkspace` function;
3. creates/updates the claimant as Workspace owner;
4. creates the normal 14-day starter trial and default Workspace configuration;
5. copies the official activity description into the new Workspace intro only when the intro is empty;
6. links the directory profile to the Workspace;
7. records the admin decision in `admin_audit_logs`;
8. changes the directory record to `claimed`.

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
- provenance values are deduplicated by profile + field + source + value hash.

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

Then verify constraints and indexes before loading test records.

### 3. Bolagsverket test environment

- request API access;
- configure test OAuth values;
- copy the current source/detail operation URLs and POST schema from Swagger;
- keep `COMPANY_DIRECTORY_AUTO_PUBLISH=false`;
- run a small sync;
- compare every normalized field against the source response.

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
- claimed profile resolves to the correct tenant Workspace.

### 5. Production activation

Only after the Preview/pilot evidence is reviewed:

1. apply migrations with branch-first production workflow;
2. configure Production Bolagsverket credentials/endpoints;
3. deploy while `COMPANY_DIRECTORY_AUTO_PUBLISH=false`;
4. run a read-only/ready-only production sync;
5. inspect the ready queue;
6. explicitly approve auto-publication only if the sample passes the acceptance gate.

## Known deliberate limits

The engine cannot guarantee that an unclaimed company's marketing photos, exact prices, detailed services, opening hours or staff roster are correct unless a reusable authoritative source provides those fields. It therefore does not invent them.

This is a correctness feature, not missing enrichment: official facts are automated; marketing facts become owner-confirmed after claim or licensed/verified enrichment later.

## Rollback

See `db/migrations/20260809_company_profile_engine_rollback_notes.md`.
