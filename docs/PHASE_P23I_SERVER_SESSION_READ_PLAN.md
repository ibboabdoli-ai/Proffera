# P23I - Server-side session read plan

Status: planned
Date: 2026-06-17
Type: documentation only
Runtime changes: none
Database changes: none
Deployment: none

## Purpose

P23I plans how Proffera should read a Better Auth session on the server before any dashboard access behavior is changed.

This phase is documentation-only.

## Current background

Already completed:

- P23B added the Better Auth route handler at `src/app/api/auth/[...all]/route.ts`.
- P23G added the Better Auth client helper at `src/lib/auth-client.ts`.
- P23H connected `/logga-in` to `authClient.signIn.email`.

The next step is to plan server-side session reading before dashboard protection changes.

## Intended future server-side session read

A future runtime phase may use this pattern:

```ts
import { headers } from "next/headers";

import { getAuth } from "@/lib/auth";

const session = await getAuth().api.getSession({
  headers: await headers(),
});
```

This must be verified in a separate runtime phase before use in dashboard access control.

## Proposed future helper

Possible future file:

- `src/lib/auth-session.ts`

Possible future helper:

```ts
import { headers } from "next/headers";

import { getAuth } from "@/lib/auth";

export async function getServerSession() {
  return getAuth().api.getSession({
    headers: await headers(),
  });
}
```

This helper must be server-only.

It must not be imported into client components.

## Important safety rule

Reading a Better Auth session is not enough to allow dashboard access.

Future dashboard access must check:

1. Session exists.
2. User exists.
3. User has valid workspace membership.
4. Workspace is allowed to access the selected dashboard area.
5. Existing Basic Auth behavior is handled intentionally in a separate phase.

## Non-goals

P23I does not:

- Add `src/lib/auth-session.ts`.
- Modify `/dashboard`.
- Modify `/logga-in`.
- Modify middleware.
- Remove Basic Auth.
- Add redirects.
- Add workspace membership enforcement.
- Change database schema.
- Deploy.

## Future phases

Recommended next phases:

- P23J - Server session helper runtime patch.
- P23K - Dashboard auth gate plan.
- P23L - Dashboard auth gate runtime draft.

## Validation

Because this is documentation-only, validation is:

- `git diff --check`
- `git status --short`

## Conclusion

P23I creates the server-side session read plan.

No runtime behavior is changed in this phase.
