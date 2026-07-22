# Proffera Project Handoff

Repository: `ibboabdoli-ai/Proffera`
Stack: Next.js, TypeScript, Tailwind, Neon/Postgres, Better Auth, Stripe, Brevo

## Release candidate

The current branch is a controlled paid-launch candidate. Read
[`CURRENT_STATUS.md`](CURRENT_STATUS.md) and run
[`TEST_CHECKLIST.md`](TEST_CHECKLIST.md) before deploying it. The baseline
production commit before this work is `08972a2`.

## Required deployment order

1. Deploy to Vercel Preview with the non-secret variable names listed in
   [`.env.example`](../.env.example).
2. Apply `db/migrations/20260722_0012_public_form_safety.sql` in Preview.
3. Run the Preview and Stripe Sandbox checks. Do not create live payments.
4. Obtain legal/business approval, then repeat the migration and smoke checks in
   production.

## Protected boundaries

- Public demo, quote and booking submissions must keep server validation,
  honeypot/timing checks, durable rate limits and consent recording.
- Public booking overlap is ultimately protected by the database constraint; the
  customer and booking insert is intentionally atomic.
- Stripe webhook entitlement sync must retrieve the current subscription before
  writing workspace status or feature flags.
- AI Chat is separate at `chat.proffera.se`; Proffera data must use tenant
  `proffera` and must never mix with Iboren.
- Do not bypass workspace role checks or place administrative secrets in URLs,
  forms, logs or documentation.

## Rollback

Revert the scoped release-candidate commits in reverse order and restore the
previous Vercel deployment. The migration only adds a rate-limit table and
nullable/additive consent columns; preserve its data during rollback unless a
separate data-retention decision is approved.
