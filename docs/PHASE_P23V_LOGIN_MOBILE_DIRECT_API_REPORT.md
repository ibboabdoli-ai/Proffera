# Phase P23V — Login mobile direct API report

## Goal
Fix the Proffera login page so mobile users can see and use the login form more reliably, and make login use the verified production Better Auth API path directly.

## Changes
- Moved the login form before the marketing copy on small screens.
- Simplified the login page copy for clearer mobile layout.
- Replaced the auth client login call with a direct POST to `/api/auth/sign-in/email` using `credentials: "include"`.
- Redirects with `window.location.assign("/dashboard")` after a successful login response.

## Validation
- `npm run lint` passed.
- `npm run build` passed.
- `git diff --check` passed.
- Production auth API was manually verified with status 200 and `set-cookie: true` before this patch.

## Notes
- No database schema changes.
- No Basic Auth removal.
- No deployment performed in this phase.
