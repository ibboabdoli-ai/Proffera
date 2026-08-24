---
applyTo: "src/lib/marketplace-*.ts,src/lib/*quote*.ts,src/features/matching/**,src/app/api/marketplace/**,src/app/**/offert/**,src/app/**/quote/**,tests/marketplace-*,tests/*quote*"
---

# Marketplace worker instructions

Use these rules together with `AGENTS.md` and `WORKER_BOOTSTRAP.md` for Marketplace request, matching, outreach, quote, comparison, award, ServiceJob and review work.

## Core Marketplace invariants

- One customer request can have **exactly one selected winner**. Selection must be transactional and race-safe.
- Invitation policy is `3 + 2`: Wave 1 sends to up to three suitable companies; Wave 2 may add up to two only when needed.
- Do not pad invitation waves with weak candidates. Broaden radius/eligibility deliberately when quality is insufficient.
- Paid status never buys marketplace trust or sponsored ranking. Ranking uses match quality, verified reputation and operational signals.
- Unclaimed/Free/Paid capability differences come from server-side entitlement/policy boundaries, not UI assumptions.

## Privacy and contact release

- Exact customer address/coordinates are private request data and stay hidden from providers before the selection/unlock boundary unless an explicitly documented flow requires otherwise.
- Public Search/Profile/SEO must not expose private request location.
- Direct company contact disclosure must follow the canonical entitlement/contact gate.
- Guest Quote access uses scoped secure tokens and must not become a general company/customer data read path.
- Contact unlock after selection must expose only the data required for the selected relationship and must not unlock losing providers.

## Lifecycle and race safety

- Award/selection, winner creation and ServiceJob creation must be idempotent under retries and concurrent requests.
- Existing offers must never silently become winner after cancel/problem/no-show/rematch.
- Rematch is an explicit new matching cycle; preserve prior audit/history and do not mutate historical outcomes into a new winner.
- ServiceJob state transitions must reject impossible or unauthorized transitions.
- Review eligibility comes only from real completed eligible Proffera work; one eligible job may produce at most one review.
- Reputation updates use approved/eligible evidence and must not count rejected or ineligible reviews.

## Outreach safety

- Respect suppression, opt-out, duplicate and frequency-cap rules across waves and retries.
- Retryable transport failures must not duplicate invitations or offers.
- Track enough state to explain why a provider was selected, skipped, suppressed or invited.

## Tests

For affected paths, cover the reachable race/negative cases, including as applicable:

- duplicate request/award submission;
- two concurrent winner attempts;
- Wave 1/Wave 2 duplication;
- suppression and opt-out;
- Guest Quote replay/expired/invalid token;
- contact leak before selection;
- losing-provider contact access;
- ServiceJob create/start/complete/cancel/problem/no-show;
- Review only after completed eligible work;
- one Review per job;
- moderation approve/reject and reputation derivation;
- rematch without automatic historical winner reuse.

Use real database-backed tests for transactional uniqueness/locking behavior when mocks cannot prove the invariant.
