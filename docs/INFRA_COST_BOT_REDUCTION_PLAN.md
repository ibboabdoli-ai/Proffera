# INFRA-COST-BOT-REDUCTION-1

Priority: HIGH / P1
Supervisor: #548
Baseline main: `7032cb916030587b20fb939eb603d82ebce7732b`

## Goal

Reduce unnecessary Production Neon wake-ups caused by repeated anonymous Public Company Directory lookups while preserving normal human access, Swedish/English behavior, claim safety, and existing private/authenticated boundaries.

This PR is intentionally the smallest code-only first slice. It does **not** change Production Vercel Firewall/WAF, Neon configuration, QStash, scheduler state, billing, plans, payment settings, data, migrations, secrets, or background automation.

## Root cause found

1. Public company profile routes remain request-dynamic, so anonymous crawler traffic still reaches the Next.js runtime.
2. Safe published/unclaimed juridical profile data already has a 24-hour shared cache and explicit invalidation.
3. A valid-looking but nonexistent company slug was not persisted as a negative result. Repeated requests could therefore repeat both the public Directory lookup and the claimed-profile fallback lookup.
4. When a public profile is absent, the redirect fallback for claimed workspaces performs another DB lookup. A repeated nonexistent slug could repeat that lookup too.
5. Claim pages already fail anonymous requests before Directory/claim DB reads; that boundary should remain unchanged.

## Code-only first slice

- Add a 30-minute cache only for **proven missing** Directory slugs.
- Reuse the existing profile invalidation tag so publication/claim/profile mutations evict stale negative results.
- Positive safe published profiles keep the existing 24-hour cache.
- Claimed profiles, paid-contact entitlement paths, sole-trader/natural-person paths, and real claimed-workspace redirects bypass the negative cache and remain request-fresh.
- Add focused regressions for repeated missing slugs, invalidation, claimed entitlement freshness, and claimed redirect freshness.

## Deliberately not included

### Full-route ISR/CDN conversion

The public company page currently mixes public profile state, claimed-profile redirect behavior, and Marketplace query-state UI. Converting it to a full-route static/ISR response without a conditional freshness design could cache claimed/private-sensitive state incorrectly. This needs a separate bounded design/review if the data-level fix and edge controls are insufficient.

### Vercel Firewall / WAF

Blocking obvious scanners (for example `/.env`, `/.git*`, WordPress/phpMyAdmin probes) and pre-launch rate limiting should happen before expensive application work. That is a Production Vercel configuration change and is not performed by this PR.

### Neon suspend/autoscaling

Current metadata shows `suspend_timeout_seconds = 0`; changing Neon compute configuration is explicitly outside this PR and requires separate approval/verification.

## Validation

Required before merge approval:

- focused cache tests;
- claim anonymous-before-DB regression remains green;
- Swedish and English Directory profile tests remain green;
- lint/typecheck/unit/build;
- CI Validate;
- CodeQL;
- current-head CodeRabbit review;
- Final Gate;
- zero material unresolved review threads.

## Merge and rollout

**Do not auto-merge.** Leave the PR unmerged even when all gates are green until the owner explicitly approves this P1 infrastructure-cost change.

After an approved deploy, observe Production for at least 6 hours without synthetic traffic and compare:

- Vercel Function executions/hour;
- Middleware executions/hour;
- top anonymous routes;
- Neon CU-hour growth;
- Neon Active-time growth;
- observed idle/suspend periods;
- 5xx rate.

QStash must remain paused and GitHub Company Directory automation must remain manual-only unless separately approved.