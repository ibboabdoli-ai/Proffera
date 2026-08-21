# CURRENT STATUS

This file is the canonical current-status handoff for Proffera. Keep it aligned with production behavior, active work, deployment state, and known operational constraints.

Vercel Production and Preview state are independently readable through the connected Vercel tooling.

Company Directory discovery uses an hourly lightweight probe of the official SCB/Bolagsverket source. A full bulk scan runs when the upstream `Last-Modified` value is newer than the latest completed discovery snapshot, once daily as a safety fallback, on manual dispatch, and after discovery automation/worker/ingest changes reach `main`. Stockholm and Södertälje remain always-on discovery locations. Outside those locations, eligible companies are admitted through a deterministic 20-bucket nationwide rollout, one bucket per UTC day, so the eligible Swedish coverage accumulates across roughly 20 daily buckets without flooding the verification queue in one run. The discovery SNI scope includes the canonical Directory mappings, including 96.210 for `frisor`. Queue and profile processing remain separate on the 15-minute operations workflow.

Dedicated Company Directory full revalidation is requested by a five-minute GitHub Actions schedule. Because scheduled workflow wake-ups can be delayed, each wake drains two sequential bounded ten-profile API batches rather than relying on exact scheduler timing. SCB transport keeps the existing 1.05-second request spacing and retries only once for transient network resets/timeouts and retryable HTTP statuses (408/425/429/5xx), with backoff; permanent response/schema errors still fail closed without repeated requests.

A Production runtime warning observed on 2026-08-18 concerns PostgreSQL connection-string SSL semantics. It is a forward-compatibility/security warning rather than an observed request failure and should be handled deliberately before the relevant `pg`/`pg-connection-string` major upgrade.
