# P22D retry plan — Better Auth dependency conflict

Status: plan only.

Date: 2026-06-15

## Goal

Retry Better Auth only after dependency compatibility is checked locally. Do not use floating `latest` for auth dependencies.

## What happened

The first P22D attempt failed during `npm install` with an `ERESOLVE` dependency conflict after adding Better Auth with a floating version.

The code dependency attempt was rolled back.

## Current safe state

- `package.json` no longer includes Better Auth, `pg`, or related type packages.
- `src/lib/auth.ts` is only a placeholder and does not import external auth packages.
- Temporary Basic Auth still protects `/dashboard`.
- No auth route is active.
- No database migration was created.

## Retry rules

Before touching `package.json` again, run these locally:

```bash
npm view better-auth version peerDependencies dependencies
npm view pg version peerDependencies dependencies
npm view @types/pg version peerDependencies dependencies
```

Then choose exact versions and install with exact pins, not `latest`:

```bash
npm install --save-exact better-auth@<exact-version> pg@<exact-version>
npm install --save-dev --save-exact @types/pg@<exact-version>
```

After install, verify locally:

```bash
npm install
npm run build
npm run lint
```

## Required output before retry patch

Capture and review:

- exact Better Auth version
- Better Auth peer dependencies
- exact `pg` version
- exact `@types/pg` version
- generated `package-lock.json` if npm creates one
- local `npm install` result
- local `npm run build` result
- local `npm run lint` result

## Retry implementation scope

The next code retry may include only:

- `package.json`
- package lock file, if generated locally
- `src/lib/auth.ts`

It must not include:

- auth route activation
- login UI changes
- dashboard protection changes
- database migration
- removal of temporary Basic Auth

## Rollback rule

If dependency installation fails again, revert the package/config change immediately and keep P22D as blocked.

## Next safe step

Run the local version/peer-dependency checks and share the output before another code patch.
