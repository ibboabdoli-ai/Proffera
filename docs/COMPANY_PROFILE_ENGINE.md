# Proffera Company Profile Engine

Status: implementation branch only. Not approved for Production rollout until the free Bolagsverket real-data pilot passes.

The current operational source of truth is:

`docs/COMPANY_PROFILE_ENGINE_ROLLOUT.md`

That document defines the zero-extra-cost policy, seed/feed discovery modes, SNI2025 scope, Stockholm/Södertälje pilot guards, migrations `0037`–`0042`, Super Admin tooling, claim reservation recovery, SEO behavior and the real-data activation sequence.

## Core architecture

```text
Official free company data
        ↓
Seed Källtest or verified free discovery feed
        ↓
Official detail verification by organisationsnummer
        ↓
SNI2025 mapping + legal-form/privacy classification
        ↓
Stockholm/Södertälje pilot guard + quality score
        ↓
Directory profile + field provenance
        ↓
Rights-aware media selection
        ↓
Public unclaimed profile + factual SEO
        ↓
Owner claim request
        ↓
Super Admin verification
        ↓
Tokenized claim reservation / stale-lease recovery
        ↓
Existing Proffera Workspace provisioning
        ↓
Claimed profile redirects to tenant public business page
```

## Non-negotiable rules

- The core path does not require a new paid data, enrichment, lead or image service.
- `COMPANY_DIRECTORY_SYNC_ENABLED=false` by default.
- `COMPANY_DIRECTORY_AUTO_PUBLISH=false` by default.
- The first real-data test uses explicit organisation-number seeds rather than guessed bulk discovery.
- Broad discovery is not enabled until the exact official/reusable free bulk/feed source is verified.
- Unverified sole traders are not automatically published.
- Unknown-rights external media cannot be published.
- SNI determines only a broad category; exact services, prices, reviews, staff and opening hours are not invented.
- Company Directory migrations are not applied to the Neon main branch before real-data pilot review.
- Paid Bolagsverket `Företagsinformation` is not part of the core engine.

See `docs/COMPANY_PROFILE_ENGINE_ROLLOUT.md` for the complete rollout contract and `db/migrations/20260809_company_profile_engine_rollback_notes.md` for rollback guidance.
