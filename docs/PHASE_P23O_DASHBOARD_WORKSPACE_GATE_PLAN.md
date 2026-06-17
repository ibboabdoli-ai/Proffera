# P23O - Dashboard workspace gate plan

Status: completed
Date: 2026-06-17
Type: documentation only
Runtime changes: none
Database changes: none
Deployment: none

## Purpose

P23O defines the safest future plan for connecting the workspace access helper to the dashboard.

This phase does not change dashboard runtime behavior.

## Current state

The dashboard layout currently reads the Better Auth server session directly.

If no session exists, the dashboard redirects to `/logga-in`.

The new `getUserWorkspaceAccess()` helper exists, but it is not connected to the dashboard yet.

## Files inspected

- `src/app/dashboard/layout.tsx`
- `src/lib/workspace-access.ts`
- `src/lib/auth-session.ts`

## Future runtime goal

In the next approved runtime phase, the dashboard should use `getUserWorkspaceAccess()` instead of reading only the raw session.

The goal is:

1. Keep the dashboard protected by Better Auth session.
2. Also require a valid workspace membership.
3. Allow only workspaces with status `active` or `trial`.
4. Fail closed if the user, membership, workspace, status, or database connection is invalid.
5. Keep Basic Auth unchanged.
6. Keep middleware unchanged.
7. Avoid database or schema changes.
8. Avoid deployment.

## Recommended future runtime patch

Only after this plan is verified, a future phase should update:

- `src/app/dashboard/layout.tsx`

Recommended minimal logic:

```tsx
import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const access = await getUserWorkspaceAccess();

  if (!access.ok) {
    redirect("/logga-in");
  }

  return <DashboardShell>{children}</DashboardShell>;
}
```

## Failure behavior for future runtime phase

Initial safe behavior should be simple and closed:

- `no_session` -> redirect to `/logga-in`
- `no_user` -> redirect to `/logga-in`
- `no_membership` -> redirect to `/logga-in`
- `workspace_not_allowed` -> redirect to `/logga-in`

A later UX phase may add a dedicated access-denied page or better error messaging.

Do not add that in the first runtime gate patch.

## Safety boundaries

P23O does not modify:

- dashboard runtime
- middleware
- Basic Auth
- database schema
- authentication routes
- login form
- workspace tables
- environment files
- Vercel configuration

P23O does not expose or commit secrets.

P23O does not deploy.

## Required verification before future runtime phase

Before changing runtime code, run:

```bash
git checkout main
git pull
git status --short
git checkout -b p23p-dashboard-workspace-gate-runtime
```

Then inspect:

```bash
sed -n '1,200p' src/app/dashboard/layout.tsx
sed -n '1,220p' src/lib/workspace-access.ts
sed -n '1,120p' src/lib/auth-session.ts
```

After the future runtime patch, verify:

```bash
npm run typecheck
npm run lint
npm run build
git restore next-env.d.ts tsconfig.json
rm -rf .next node_modules
git diff --check
git status --short
```

If `next build` needs database access, export a real `DATABASE_URL` only in the shell session.

Never commit the database URL.

## Important environment note

The previous phase found that pulled Vercel env files still had empty placeholder database values.

A separate configuration phase is still needed later for:

- `DATABASE_URL`
- `POSTGRES_URL`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_SECRET`

Do not fix those in this documentation or runtime gate phase.

## Conclusion

P23O only documents the future dashboard workspace gate.

The recommended future runtime change is minimal: replace the raw dashboard session gate with `getUserWorkspaceAccess()` and redirect to `/logga-in` when access is not valid.

No runtime, database, middleware, Basic Auth, environment, or deployment behavior is changed in P23O.
