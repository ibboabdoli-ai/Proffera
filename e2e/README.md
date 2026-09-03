# Proffera browser E2E

This directory contains Playwright tests that are intentionally isolated from the application dependency tree.

## Safety boundary

- The default target is the local Next.js server at `http://127.0.0.1:3000`.
- `proffera.se` and `www.proffera.se` are hard-blocked in the Playwright config.
- A remote Preview/Staging URL is accepted only when `E2E_ALLOW_REMOTE=true` is set explicitly.
- State-changing remote tests must not run until Preview/Staging database, auth, email, payment, and tenant isolation are verified as isolated from Production.
- Public smoke tests remain non-destructive.
- Authenticated and booking Preview smoke tests require dedicated test users/workspaces and skip automatically when their environment values are absent.

## Local public smoke

From the repository root:

```bash
npm ci
cd e2e
npm ci
npx playwright install chromium
npm test
```

The Playwright web server starts the root Next.js application automatically.

Current local/public browser coverage includes:

- marketplace/marketing navigation;
- nearby/geolocation behavior;
- login-page rendering;
- quote-intake service selection and transition into adaptive details without submitting a quote.

## Isolated authenticated Preview smoke

Only use dedicated Preview/Staging test accounts. Never put real customer credentials in repository files.

Required environment values for the two-account Workspace-isolation smoke:

```text
E2E_USER_A_EMAIL
E2E_USER_A_PASSWORD
E2E_USER_A_WORKSPACE_NAME
E2E_USER_B_EMAIL
E2E_USER_B_PASSWORD
E2E_USER_B_WORKSPACE_NAME
```

Optional read-only booking-page smoke:

```text
E2E_BOOKING_SLUG
```

Run only against a verified isolated Preview/Staging environment:

```bash
cd e2e
E2E_BASE_URL="https://verified-preview.example" \
E2E_ALLOW_REMOTE=true \
E2E_USER_A_EMAIL="..." \
E2E_USER_A_PASSWORD="..." \
E2E_USER_A_WORKSPACE_NAME="..." \
E2E_USER_B_EMAIL="..." \
E2E_USER_B_PASSWORD="..." \
E2E_USER_B_WORKSPACE_NAME="..." \
E2E_BOOKING_SLUG="..." \
npm test
```

The authenticated smoke verifies each test account sees its own Workspace name and does not render the other test Workspace name. The booking smoke only renders the published test booking page; it does not create a booking or send verification email.

## Full Marketplace lifecycle in Vercel Preview

`marketplace-preview-lifecycle.e2e.mjs` is a state-changing proof and is deliberately narrower than the general E2E suite. It is enabled only with `E2E_MARKETPLACE_PREVIEW_LIFECYCLE=true` and only against a non-Production remote URL accepted by the Playwright safety gate.

The matching fixture and controlled email reader are also fail-closed in application code: they return 404 unless Vercel reports `VERCEL_ENV=preview` and the exact Git branch is `work/proffera-marketplace-browser-lifecycle-e2e`. Every test run additionally requires a random `x-proffera-preview-e2e-run` scope header.

The hosted workflow resolves the successful Vercel Preview deployment for the exact pull-request SHA before running Playwright. The journey uses only synthetic customer identities and an isolated synthetic provider. The provider is positioned at a synthetic coordinate far from Swedish Directory profiles so targeted matching cannot select a real company.

Preview email is not mocked in this proof. The application must use its canonical Preview Brevo key and controlled-recipient rewrite. A Preview-only reader queries the dedicated Preview Brevo account for the controlled sink, extracts only the expected Preview link, and verifies that the original synthetic `.invalid` recipient was not observed as an email recipient.

The lifecycle assertion is:

`Quote → Matching → Invitation → Provider Offer → Customer Selection → ServiceJob → Completed → Verified Review`

It additionally proves two synthetic customers stay isolated, duplicate selection creates one ServiceJob, no review invitation exists before completion, a used/invalid review token fails, exactly one review is stored, and scoped cleanup deletes only the current run's synthetic Preview records.

## Activation gate for full critical-flow E2E

Before enabling authenticated tests as a required CI gate, verify all of the following:

1. Preview uses an isolated non-Production database.
2. Two dedicated Better Auth test users exist.
3. Each test user belongs only to its dedicated test Workspace for the isolation smoke.
4. The test booking Workspace/slug is dedicated to E2E.
5. Preview email delivery is sandboxed or disabled from real recipients.
6. No Production Stripe keys, customer Workspaces, or real booking data are reachable.

Until those conditions are proven, the authenticated tests remain opt-in and skipped by default.

## Still intentionally not automated as state-changing browser tests

The following still require separate isolated Preview/Staging contracts before browser automation may submit mutations:

- complete Booking → email verification → confirmation;
- payment/Stripe lifecycle;
- destructive Admin mutations.

Do not use this suite to create fake Production bookings, quotes, users, payments, or email traffic.
