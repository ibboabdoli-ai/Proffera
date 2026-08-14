# Proffera browser E2E

This directory contains Playwright tests that are intentionally isolated from the application dependency tree.

## Safety boundary

- The default target is the local Next.js server at `http://127.0.0.1:3000`.
- `proffera.se` and `www.proffera.se` are hard-blocked in the Playwright config.
- A remote Preview/Staging URL is accepted only when `E2E_ALLOW_REMOTE=true` is set explicitly.
- Remote state-changing tests must not be added until Preview/Staging database, auth, email, payment, and tenant isolation have been verified.
- The initial suite performs only non-destructive public GET/navigation smoke tests.

## Local run

From the repository root:

```bash
npm ci
cd e2e
npm ci
npx playwright install chromium
npm test
```

The Playwright web server starts the root Next.js application automatically.

## Approved remote Preview/Staging run

Only after the target environment has been verified as isolated from Production:

```bash
cd e2e
E2E_BASE_URL="https://verified-preview.example" E2E_ALLOW_REMOTE=true npm test
```

Do not use this suite to create fake Production bookings, quotes, users, payments, or email traffic.
