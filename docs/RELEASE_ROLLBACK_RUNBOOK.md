# Proffera Release Rollback Runbook

## Purpose

Use this runbook when a newly deployed Proffera release introduces a verified Production regression and rollback is safer than an immediate forward fix.

This document does **not** authorize a Production mutation. Promoting a previous Production deployment, changing Vercel configuration, changing secrets, or applying/reversing database migrations still requires the applicable owner approval.

## Safety model

A normal application rollback means restoring a previously verified Vercel deployment while leaving the database unchanged unless a separate database rollback is explicitly approved.

Classify the database impact before any rollback:

- `none` — no schema/data dependency changed.
- `additive` — the release only added backward-compatible schema/data structures and the previous application version is proven compatible with them.
- `destructive` — columns/tables/data/contracts were removed or rewritten.
- `unknown` — database compatibility has not been proven.

Only `none` and proven-compatible `additive` changes are eligible for the standard application rollback path. `destructive` or `unknown` changes stop the standard path and require a separate database/migration recovery plan and explicit approval.

## Required evidence

Before requesting rollback authorization, record:

1. the exact currently deployed bad commit SHA;
2. the exact known-good target commit SHA;
3. the exact known-good `https://*.vercel.app` deployment URL;
4. the database impact classification;
5. the user-visible regression or health failure that triggered rollback;
6. the expected post-rollback smoke checks.

Do not use `proffera.se` as the rollback target identifier. The target must be the immutable deployment URL so the intended artifact is unambiguous.

## Dry-run preflight

Run the repository validator before any Production action:

```bash
node scripts/release-rollback-plan.mjs '{"currentSha":"<40-char-bad-sha>","targetSha":"<40-char-known-good-sha>","targetDeploymentUrl":"https://<known-good>.vercel.app","databaseChange":"none"}'
```

The command is read-only. It never calls Vercel, GitHub, Neon, Stripe, Brevo, or any Production API.

A non-zero exit means the standard rollback path is blocked.

## Authorized rollback sequence

After the preflight is green and the required owner authorization exists:

1. freeze unrelated release/merge activity for the affected graph path;
2. confirm the target deployment still maps to the recorded known-good SHA;
3. promote/restore that exact previous Vercel Production deployment using the authorized Vercel path;
4. do **not** run a database down-migration as part of the application rollback;
5. verify `proffera.se` is serving the intended rollback SHA;
6. run the existing exact-SHA Production health gate;
7. run the smallest affected Production smoke checks;
8. confirm no new critical errors are appearing in runtime logs;
9. record the incident, rollback SHA, verification result, and follow-up fix.

If the previous application is not compatible with the current additive schema, stop and roll forward with a compatible patch instead of forcing a database rollback.

## Always stop for separate approval

The standard runbook does not cover or authorize:

- destructive database rollback or manual Production SQL;
- migration reversal;
- Vercel environment/secret changes;
- Neon configuration changes;
- scheduler/cron changes;
- Stripe/payment-provider changes;
- destructive cleanup;
- external customer/provider actions.

These remain separate restricted actions under the Proffera Supervisor contract.
