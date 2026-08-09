# Proffera Company Profile Engine

Status: implementation branch only. Not approved for Production rollout until the free Bolagsverket real-data pilot passes.

The operational source of truth is `docs/COMPANY_PROFILE_ENGINE_ROLLOUT.md`.

## Core architecture

```text
Official free company data
→ seed Källtest or verified free discovery feed
→ official detail verification by organisationsnummer
→ SNI2025 + privacy + Stockholm/Södertälje quality gates
→ directory profile + provenance + rights-aware media
→ factual public profile + SEO
→ verified owner claim
→ tokenized reservation / stale-lease recovery
→ existing Proffera Workspace provisioning
```

## Non-negotiable rules

- No new paid data, enrichment, lead or image service is required by the core path.
- Sync and auto-publication default to off.
- The first real-data pilot uses explicit organisation-number seeds and does not guess official API request schemas.
- Broad discovery waits for a verified official/reusable free bulk/feed source.
- Sole traders are not automatically published in the first rollout.
- Unknown-rights external media cannot publish.
- SNI is only a broad category signal; exact services, prices, reviews, staff and opening hours are not invented.
- Company Profile Engine migrations do not reach the Neon main branch before real-data pilot review.
- Paid Bolagsverket `Företagsinformation` is not part of the core engine.

See `docs/COMPANY_PROFILE_ENGINE_ROLLOUT.md` for the complete rollout contract and `db/migrations/20260809_company_profile_engine_rollback_notes.md` for rollback guidance.
