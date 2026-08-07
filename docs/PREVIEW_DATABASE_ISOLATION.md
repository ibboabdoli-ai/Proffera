# Preview database isolation

## Purpose

Vercel Preview deployments must never read from or write to the Production database.

## Active Preview database

- Neon project: `businessdirectory` (`late-water-28070748`)
- Dedicated Preview branch: `vercel-preview-20260807`
- Branch ID: `br-twilight-field-adg7752n`
- The branch was cloned from the current Production schema and then sanitized before use.
- Preview tenant/auth/business data must remain disposable. Production customer data must not be copied back into this branch after sanitization.

## Vercel configuration

- Secret name: `PROFFERA_PREVIEW_DATABASE_URL`
- Application code reads this secret only when `VERCEL_ENV=preview`.
- Production ignores `PROFFERA_PREVIEW_DATABASE_URL`, even if the Vercel dashboard exposes the secret to a combined Production/Preview target.
- Existing Production `DATABASE_URL` remains the Production source of truth.
- No database credentials are committed to Git.

## Ownership

The Proffera platform engineering/admin workflow owns the Preview branch and its Vercel secret configuration.

## Rotation and refresh

When the Production schema changes enough that Preview is stale:

1. Create a fresh Neon child branch from current Production.
2. Sanitize all tenant, auth, customer, booking, job, payment, review, invitation and audit data before connecting it to Vercel.
3. Verify the sanitized branch contains no real users/workspaces/customers/bookings/jobs.
4. Update `PROFFERA_PREVIEW_DATABASE_URL` to the fresh branch connection string.
5. Trigger a new Vercel Preview deployment and verify authenticated runtime behavior.
6. Delete the superseded Preview branch only after the new branch is proven healthy.

## Validation gate

A Preview database configuration is accepted only when all of the following are true:

- CI, typecheck, tests and build pass.
- A Vercel Preview created after the secret update is READY.
- The Preview runtime can initialize auth without the missing-database error.
- The Preview database is proven non-Production and sanitized.
- No Production data is mutated during validation.
