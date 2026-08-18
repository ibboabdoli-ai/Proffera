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

## Still intentionally not automated as state-changing browser tests

The following require a proven isolated Preview/Staging data and delivery setup before browser automation may submit mutations:

- complete Booking → email verification → confirmation;
- Quote Request submission → Offer → Accept/Reject;
- payment/Stripe lifecycle;
- destructive Admin mutations.

Do not use this suite to create fake Production bookings, quotes, users, payments, or email traffic.
