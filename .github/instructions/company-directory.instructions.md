---
applyTo: "src/lib/company-directory-*.ts,src/components/company-directory/**,src/app/api/cron/company-directory-*/**,src/app/api/public-directory/**,src/app/en/companies/**,src/app/foretag/listad/**,tests/company-directory-*"
---

# Company Directory worker instructions

Use these rules together with `AGENTS.md` and `WORKER_BOOTSTRAP.md` for Company Directory, SCB, Official Facts, revalidation, publication and geocoding work.

## Canonical data semantics

- `company_directory_profiles.id` is the stable Directory business identity.
- Official legal identity and legal-state evidence remain authoritative for publication safety.
- SCB **Företag** municipality/registered seat is not the physical workplace location.
- Physical workplace geography comes from conflict-free SCB **Arbetsställe** evidence, primarily `BesöksAdress` plus workplace `Kommun`.
- A verified Lantmäteriet address/coordinate is a location fact, not a provider service-area declaration.
- Exact customer/request location data never belongs in public Directory/Search/SEO projections.

## Revalidation safety

- Published/Ready safety work must fail closed when fresh legal or evidence conflicts make publication unsafe.
- `inactive` profiles must not be sent through an active-only SCB company/workplace lookup solely because SCB evidence is missing/stale; Official Facts refresh may still be relevant.
- Claimed profiles require the current claimed-Workspace protection rules; do not invent automated demotion behavior for them.
- Deterministic external match failures must be bounded and persisted as failure state without fabricating successful evidence.
- Failure-only SCB persistence must not leave a valid-looking non-empty source hash from older evidence.
- Reversible Review/legal states need a bounded recovery/recheck path; do not create permanent dead-ends.
- Preserve batch caps, pacing, lease/concurrency behavior and external API rate limits unless the task explicitly changes them.

## Source-of-truth and retry rules

- Reuse shared typed provider contracts/errors instead of matching duplicated message strings across modules.
- Before adding retry state, identify the exact evidence snapshot/token that makes a retry meaningfully different.
- Do not retry the same deterministic evidence every worker wake.
- Distinguish transient transport/service failures from deterministic no-match/conflict states.

## Tests

- Prefer the canonical migration path and shared PostgreSQL helpers over hand-copied Directory DDL.
- When the bug is candidate selection, locking, upsert conflict behavior, recovery eligibility or persisted provenance, include PostgreSQL-backed regression coverage when practical.
- Keep heavy Docker/PostgreSQL suites explicitly opt-in according to the repository integration-test convention.
- Add negative coverage for stale evidence, claimed profiles, inactive profiles and recovery loops when those edges are reachable from the change.

## Public-surface checks

When a Directory change can affect public data, verify the reachable projections as applicable:

- Directory profile;
- Search card/result;
- SEO/structured data/sitemap;
- Claim/owner overlay;
- Marketplace provider projection;
- contact/location privacy gates.
