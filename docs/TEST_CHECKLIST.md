# Proffera Release Checklist

## Local gate (required for every release candidate)

- [x] `npm ci --no-audit --no-fund` succeeds with the committed lockfile.
- [x] `npm test` passes.
- [x] `npm run lint` passes.
- [x] `npm run typecheck` passes.
- [x] `npm run build` passes.
- [ ] Review `git diff --check` and confirm no secret is committed.

## International B2B and tenant-isolation gate

- [ ] Verify `20260801_0020_workspace_market_settings.sql` on a Neon temporary
  branch, then apply it only after explicit migration approval.
- [ ] Confirm existing Swedish workspaces retain `SE` / `Europe/Stockholm` /
  `SEK`, and PrimeView is `GB` / `Europe/London` / `GBP` after migration.
- [ ] In a Preview workspace, save Sweden, one supported EU country and the UK;
  verify an invalid country/currency pairing is rejected server-side.
- [ ] Create a public booking in a non-Stockholm workspace and verify the stored
  UTC timestamp, visible time and notification time all match that workspace's
  selected IANA zone, including a daylight-saving boundary.
- [ ] Start a Checkout session, change the workspace market, then start again;
  verify the old open Checkout session is expired and cannot be paid.
- [ ] Verify billing address and VAT ID collection in Stripe Checkout. Do not
  enable automatic tax without completed Stripe Tax registration review.
- [ ] With designated test accounts, sign into two different workspaces and
  confirm each sees only its own customers, bookings, leads and settings.
- [ ] Confirm no customer, booking or event row remains in the retired `default`
  workspace before declaring tenant isolation complete.

## Live Stripe local-currency configuration (2026-08-02)

- [x] Read back the two live recurring Prices: Starter is `299 SEK` / `€28` /
  `£24` monthly; Professional is `699 SEK` / `€64` / `£55` monthly. All
  currency options use `inclusive` tax behaviour.
- [x] Confirmed that the Stripe account had zero subscriptions before the
  currency options were added; no existing customer renewal was changed.
- [ ] Open, but do not complete, a Checkout Session from Sweden, an EU country
  and the UK to confirm Stripe presents the matching currency option.

## Preview + Stripe Sandbox gate

- [ ] Apply and verify `20260722_0012_public_form_safety.sql` in Preview.
- [ ] Submit a demo request; confirm consent, consent version and rate limit are
  stored and that the operational inbox/notification receives the request.
- [ ] Submit a valid quote request and verify invalid categories/service types
  return form errors rather than a server error.
- [ ] Create a public booking; confirm customer creation, booking confirmation
  and owner notification. Re-submit the same time slot and confirm no duplicate
  booking or orphan customer is created.
- [ ] Start a Starter Stripe Sandbox checkout; confirm the webhook activates the
  correct workspace features and the customer portal opens.
- [ ] Try a second plan before completing the first Checkout session; confirm
  the old session cannot be paid and only the selected plan remains payable.
- [ ] Deliver delayed/out-of-order subscription webhooks and confirm the current
  Stripe subscription snapshot controls the entitlement.
- [ ] Upgrade to Professional, then cancel at period end; confirm CRM access
  follows the confirmed subscription status.
- [ ] Check desktop and mobile routes: `/`, `/demo`, `/kontakt`, `/priser`,
  `/boka/[slug]`, `/dashboard`, `/dashboard/installningar`.
- [ ] Verify AI Chat traffic appears only in tenant `proffera`.

## Production gate

- [ ] Apply the migration after Preview approval and verify it on production.
- [ ] Configure Vercel values from `.env.example`; use a production-only rate
  limit secret and live Stripe values only after explicit payment approval.
- [ ] Obtain legal/business approval for public copy, terms, privacy policy and
  processor list.
- [ ] Confirm rollback target and deployment health before announcing launch.
