# P23K - Dashboard auth gate plan

Status: planned
Date: 2026-06-17
Type: documentation only
Runtime changes: none
Database changes: none
Deployment: none

## Purpose

P23K plans how Proffera should protect dashboard routes with Better Auth session checks and workspace authorization.

This phase is documentation-only.

## Current background

Already completed:

- P23B added the Better Auth route handler at `src/app/api/auth/[...all]/route.ts`.
- P23G added the Better Auth client helper at `src/lib/auth-client.ts`.
- P23H connected `/logga-in` to `authClient.signIn.email`.
- P23I planned server-side session reading.
- P23J added `src/lib/auth-session.ts` with `getServerSession()`.

## Important principle

A Better Auth session proves authentication only.

It does not prove dashboard authorization.

Dashboard access must also verify workspace membership and workspace access rules.

## Future dashboard auth gate requirements

A future runtime phase should protect dashboard access with these checks:

1. Read the Better Auth session on the server.
2. If no session exists, redirect to `/logga-in`.
3. If a session exists, verify the user exists.
4. Verify the user has at least one active workspace membership.
5. Verify the selected workspace is allowed for the requested dashboard area.
6. If workspace access is missing, show a safe Swedish access-denied state or redirect to a safe page.
7. Keep Basic Auth behavior unchanged until a dedicated transition phase.

## Proposed future files

Possible future runtime changes may touch:

- `src/app/dashboard/layout.tsx` or a dashboard-specific server wrapper.
- `src/lib/auth-session.ts` if helper extension is needed.
- A future workspace access helper, for example `src/lib/workspace-access.ts`.

P23K does not create or modify these files.

## Proposed future behavior

Future dashboard protection should be server-side first.

Client-side checks may improve UX, but must not be the primary protection.

Server-side dashboard logic should avoid leaking whether a user, workspace, or membership exists.

All failed access checks should use generic Swedish copy.

## Basic Auth transition rule

Basic Auth must not be removed in the same phase as the first Better Auth dashboard gate.

Recommended approach:

1. Add Better Auth dashboard gate while keeping Basic Auth unchanged.
2. Verify Better Auth session and workspace checks safely.
3. Plan Basic Auth transition separately.
4. Remove or narrow Basic Auth only after explicit approval.

## Non-goals

P23K does not:

- Modify `/dashboard`.
- Modify `/logga-in`.
- Modify middleware.
- Add redirects.
- Add workspace membership checks.
- Add database queries.
- Remove Basic Auth.
- Change database schema.
- Deploy.

## Risk notes

Risk 1: Session-only access would be too weak.

Mitigation: always require workspace authorization before dashboard access.

Risk 2: Removing Basic Auth too early could expose private dashboard pages.

Mitigation: keep Basic Auth until a dedicated transition phase.

Risk 3: Error copy could reveal account or workspace existence.

Mitigation: use generic Swedish access-denied copy.

## Recommended next phases

- P23L - Dashboard auth gate runtime draft.
- P23M - Workspace access helper plan, if needed.
- P23N - Basic Auth transition plan.

## Validation

Because this phase is documentation-only, validation is:

- `git diff --check`
- `git status --short`

## Conclusion

P23K defines the dashboard auth gate plan.

No runtime behavior is changed in this phase.
