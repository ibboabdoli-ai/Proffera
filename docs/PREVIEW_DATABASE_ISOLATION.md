# Preview database and auth isolation

## Purpose

Vercel Preview deployments must never read from or write to the Production database, and must never reuse Production auth secrets.

## Active Preview database

- Neon project: `businessdirectory` (`late-water-28070748`)
- Dedicated Preview branch: `vercel-preview-20260807`
- Branch ID: `br-twilight-field-adg7752n`
- The branch is intentionally separate from Production and remains disposable.
- On 2026-08-21 its schema was refreshed in place to the current `main` Marketplace/SCB schema without resetting it from Production.
- On 2026-08-21 all tenant, auth, customer, booking, quote, company-profile, marketplace invitation/offer, payment, review and audit rows were removed from the Preview branch.
- Only non-sensitive reference data is retained: PostGIS spatial references, the feature catalog, Directory service categories and Directory services.
- Preview tenant/auth/business data must remain disposable. Production customer data must never be copied back into this branch after sanitization.

## Vercel configuration

### Database

- Secret name: `PROFFERA_PREVIEW_DATABASE_URL`
- Application code reads this secret only when `VERCEL_ENV=preview`.
- Production ignores `PROFFERA_PREVIEW_DATABASE_URL`, even if the Vercel dashboard exposes the secret to a combined Production/Preview target.
- Existing Production `DATABASE_URL` remains the Production source of truth.
- Preview fails closed instead of falling back to a shared Production database URL when the dedicated Preview value is missing.
- Preview also fails closed when the dedicated Preview URL resolves to the same database target as a shared database URL, including pooled/unpooled hostname variants.

### Auth

- Secret name: `PROFFERA_PREVIEW_AUTH_SECRET`
- Application code reads this secret only when `VERCEL_ENV=preview`.
- Preview does not fall back to Production `BETTER_AUTH_SECRET` or `AUTH_SECRET`.
- Production continues to use its existing Better Auth secret configuration and ignores `PROFFERA_PREVIEW_AUTH_SECRET`.
- Preview auth secrets must be generated independently from Production secrets and rotated separately.

### Email, SMS and payments

- Preview transactional email requires the dedicated `PROFFERA_PREVIEW_BREVO_API_KEY` and is rewritten to the single `PROFFERA_PREVIEW_EMAIL_RECIPIENT`.
- Preview does not reuse the shared Production Brevo credential; missing safe Preview email configuration fails closed.
- Marketplace Guest Quote invitations use the same Preview Brevo-key resolver and controlled-recipient rewrite, so that flow cannot bypass the Preview email boundary.
- Booking SMS delivery is disabled in Vercel Preview.
- Preview Stripe resolves only dedicated `PROFFERA_PREVIEW_STRIPE_*` test configuration and does not use Production Stripe credentials.

No database credentials, auth secrets, Brevo credentials or Stripe secrets are committed to Git.

## Ownership

The Proffera platform engineering/admin workflow owns the Preview branch and its Vercel secret configuration.

## Rotation and refresh

When the Production schema changes enough that Preview is stale:

1. Prefer applying the repository's already-approved additive migrations to the existing sanitized Preview branch when that preserves the isolation boundary safely.
2. If a fresh Neon child branch is required, keep it disconnected from Vercel until all real tenant/auth/customer/business data has been sanitized.
3. Verify the target branch contains no real users, workspaces, customers, bookings, quotes, jobs, payments, reviews, marketplace invitations/offers or admin audit data before connecting it to Vercel.
4. Update `PROFFERA_PREVIEW_DATABASE_URL` only after the sanitized target branch is proven safe.
5. Keep or rotate `PROFFERA_PREVIEW_AUTH_SECRET` independently from Production.
6. Trigger a new Vercel Preview deployment and verify authenticated runtime behavior.
7. Delete any temporary Production-snapshot branch as soon as it is no longer needed.
8. Delete a superseded Preview branch only after the replacement is proven healthy.

## Validation gate

A Preview isolation configuration is accepted only when all of the following are true:

- CI, typecheck, tests and build pass.
- A Vercel Preview created after the relevant code/config refresh is READY.
- The Preview runtime can initialize Better Auth and create/sign in a disposable test account.
- The Preview database is proven non-Production and sanitized.
- Production ignores Preview-only database/auth/email/payment secrets.
- Preview email can reach only the configured controlled recipient.
- Stripe is in test mode and no Production payment/customer data is reachable.
- No Production data is mutated during validation.

## 2026-08-21 runtime proof

The active Preview was exercised against the sanitized Neon branch on 2026-08-21:

- database identity resolved to the dedicated non-Production branch and the database contained no real tenant/auth/customer/company/quote/payment/review data;
- Better Auth created and signed in a disposable Preview-only account and issued a session cookie; the disposable user/account/session rows were then deleted;
- Stripe resolved in test mode with dedicated Preview webhook and plan-price configuration;
- a controlled Preview email recipient was configured, but a dedicated Preview Brevo API key was not available, so outbound Preview email remained intentionally fail-closed;
- the Marketplace Guest Quote sender was hardened so it now uses the Preview-only Brevo-key resolver and controlled-recipient rewrite instead of reading the shared credential/recipient directly;
- a no-egress synthetic Guest Quote state test created a disposable Preview-only company, quote and invitation with a known synthetic token, rendered the real guest response page, recorded `sent -> viewed`, submitted a fixed-price test offer through a Preview-only temporary harness, recorded invitation `responded`, quote `answered` and offer `submitted`, rendered the real success page, then deleted all disposable rows;
- after cleanup the Preview branch again contained zero users, sessions, accounts, company profiles, quote requests, marketplace invitations and marketplace offers.

The remaining activation blockers are operational rather than database-state blockers: configure a genuinely independent `PROFFERA_PREVIEW_BREVO_API_KEY`, rotate the current Preview Better Auth secret to a strong random value, and then verify controlled-recipient email egress plus the normal Admin-visible end-to-end route before enabling recurring state-changing browser automation.

## Marketplace state-changing E2E gate

Marketplace Guest Quote E2E may run only after the validation gate above is proven for the active Vercel Preview. The intended isolated sequence is:

1. create a disposable Preview user/workspace and Preview super-admin authorization;
2. create only synthetic test company/profile and quote data in Preview;
3. send the Guest Quote invitation through Preview so email is redirected to the controlled Preview recipient;
4. open the signed guest link and submit a test offer;
5. verify Preview invitation, offer and quote status transitions plus Admin visibility;
6. verify Production counts and records remain unchanged;
7. clean the disposable Preview test data after the run.

The core Guest Quote state transitions are now proven with synthetic Preview data and no external email egress. Full browser automation remains gated until the dedicated Preview Brevo credential and stronger Preview auth secret are configured and the complete controlled-recipient/Admin path is re-run.
