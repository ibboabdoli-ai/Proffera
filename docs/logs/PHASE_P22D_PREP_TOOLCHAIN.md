# P22D-prep — Local toolchain alignment

Status: completed.

Date: 2026-06-15

## Goal

Fix the local/runtime toolchain mismatch before retrying Better Auth installation.

## Trigger

Local output showed:

- `next@16.2.2` requires Node `>=20.9.0`.
- The current local environment was Node `16.20.2`.
- `eslint@latest` resolved to ESLint 10 and caused lint failure with the current Next ESLint setup.

## Built

- Added `.nvmrc` with Node 22.
- Added `engines.node` requirement to `package.json`.
- Pinned `eslint` to `9.39.1` instead of `latest`.

## Scope boundaries

No changes were made to:

- Better Auth dependency.
- Auth routes.
- Auth database schema.
- Login flow.
- Dashboard protection logic.
- CRM/booking/customer data flow.
- Service AI Chat.

## Verification

Remote code inspection completed.

Local verification still required after pulling this change:

```bash
nvm use
node -v
npm install
npm run build
npm run lint
```

## Next safe step

Only retry Better Auth installation after local Node and lint/build are stable.
