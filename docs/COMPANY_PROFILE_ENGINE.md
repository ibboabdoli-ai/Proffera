# Proffera Company Profile Engine

Status: implementation branch + isolated real-data Preview pilot. Not approved for Production rollout.

The operational source of truth is `docs/COMPANY_PROFILE_ENGINE_ROLLOUT.md`.

## Core architecture

```text
Official SCB HVD bulk
→ primary SNI Ng1 + JurForm + pilot-location discovery
→ durable queue
→ official Bolagsverket /organisationer verification
→ SNI2025 + privacy + quality gates
→ directory profile + provenance + rights-aware media
→ factual public profile + SEO
→ verified owner claim
→ tokenized reservation / stale-lease recovery
→ existing Proffera Workspace provisioning
```

## Non-negotiable rules

- No new paid data, enrichment, lead or image service is required by the core path.
- SCB bulk discovery never guesses organisation numbers and stores no raw bulk rows in Neon.
- Only the official primary SNI (`Ng1`) drives automatic discovery; secondary SNI codes do not qualify a company.
- Bolagsverket detail verification occurs before any directory profile write.
- Sync and auto-publication are separate controls; auto-publication remains off through pilot/release review.
- Sole traders are not automatically published in the first rollout.
- Unknown-rights external media cannot publish.
- SNI is only a broad category signal; exact services, prices, reviews, staff and opening hours are not invented.
- Company Profile Engine migrations do not reach Neon main before explicit Production approval.
- Paid Bolagsverket `Företagsinformation` is not part of the core engine.

## Real-data pilot result

The isolated Preview/Neon pilot proved the full free-data path from SCB bulk discovery through Bolagsverket Production detail verification and durable profile creation. Legal-form filtering, primary-SNI filtering, retry handling and category boundaries were tightened using the pilot evidence. No pilot profile was automatically published and Production/Main remained untouched.

See `docs/COMPANY_PROFILE_ENGINE_ROLLOUT.md` for the complete rollout contract and `db/migrations/20260809_company_profile_engine_rollback_notes.md` for rollback guidance.
