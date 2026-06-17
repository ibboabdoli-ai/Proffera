# P23Q - Production auth environment configuration plan

Status: planned
Date: 2026-06-17
Type: documentation only
Runtime changes: none
Database changes: none
Deployment: none

## Purpose

P23Q documents the required production environment configuration before deploying the Better Auth dashboard gate.

## Current problem

Local and pulled Vercel environment files showed placeholder database values with length 2.

Build only passed after a real DATABASE_URL was exported into the shell.

This means production environment configuration must be fixed before deployment.

## Required environment variables

- DATABASE_URL
- POSTGRES_URL
- POSTGRES_PRISMA_URL
- POSTGRES_URL_NON_POOLING
- BETTER_AUTH_SECRET
- BETTER_AUTH_URL

## Required checks

Before deployment, verify that Vercel production environment has real values for database connection variables.

Do not commit secrets to the repository.

Do not paste secrets into GitHub, docs, commits, PRs, or chat.

BETTER_AUTH_SECRET must be a strong production secret and must not use the Better Auth default secret.

BETTER_AUTH_URL must match the production website origin.

## Safety rules

P23Q does not change runtime code.

P23Q does not deploy.

P23Q does not modify dashboard routes.

P23Q does not modify middleware.

P23Q does not remove Basic Auth.

P23Q does not change database schema.

## Future config phase

A later configuration-only phase should update Vercel environment variables outside the repository.

After configuration, run build again without manually exporting DATABASE_URL.

## Validation

- git diff --check
- git status --short

## Conclusion

P23Q records the production auth and database environment requirements.

No runtime behavior is changed in this phase.
