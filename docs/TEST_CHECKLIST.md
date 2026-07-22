# Proffera Release Checklist

## Local gate (required for every release candidate)

- [x] `npm ci --no-audit --no-fund` succeeds with the committed lockfile.
- [x] `npm test` passes.
- [x] `npm run lint` passes.
- [x] `npm run typecheck` passes.
- [x] `npm run build` passes.
- [ ] Review `git diff --check` and confirm no secret is committed.

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
