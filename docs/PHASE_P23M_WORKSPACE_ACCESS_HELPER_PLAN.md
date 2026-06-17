# P23M - Workspace access helper plan

Status: planned
Date: 2026-06-17
Type: documentation only
Runtime changes: none
Database changes: none
Deployment: none

## Purpose

P23M plans how Proffera should check workspace access after a Better Auth session exists.

This phase is documentation-only.

## Current background

Already completed:

- P23H connected `/logga-in` to Better Auth login submit.
- P23J added `getServerSession()` in `src/lib/auth-session.ts`.
- P23L added a minimal dashboard session gate.

P23L only checks whether a Better Auth session exists.

P23M plans the next authorization layer: workspace access.

## Important principle

Authentication is not authorization.

A Better Auth session only proves that the user is logged in.

Dashboard access must also verify workspace membership and workspace permissions.

## Existing database context

The production migration created workspace-related tables:

- `workspaces`
- `workspace_memberships`
- `workspace_plans`
- `workspace_feature_flags`

Future runtime code should use these tables for workspace authorization.

## Future workspace access requirements

A future helper should check:

1. A session exists.
2. The session has a user id.
3. The user exists.
4. The user has at least one active workspace membership.
5. The workspace exists.
6. The workspace is active or allowed.
7. The membership role is allowed for the requested dashboard area.
8. Feature flags and plan limits are respected when needed.

## Proposed future helper

Possible future file:

- `src/lib/workspace-access.ts`

Possible helper names:

- `getUserWorkspaceAccess`
- `requireWorkspaceAccess`
- `getPrimaryWorkspaceForUser`

The first runtime helper should stay small and read-only.

It should not mutate users, memberships, workspaces, plans, or feature flags.

## Proposed future return shape

A future helper may return a normalized object like:

```ts
type WorkspaceAccessResult =
  | {
      ok: true;
      userId: string;
      workspaceId: string;
      role: string;
    }
  | {
      ok: false;
      reason: "no_session" | "no_user" | "no_membership" | "workspace_not_allowed";
    };
```

Runtime implementation details must be verified in a separate phase.

## Dashboard behavior plan

Future dashboard access should follow this order:

1. Read server session with `getServerSession()`.
2. If no session exists, redirect to `/logga-in`.
3. If session exists, check workspace access.
4. If workspace access exists, render dashboard.
5. If workspace access is missing, show safe Swedish access-denied copy or redirect to a safe page.

## Access-denied safety

Access-denied copy must be generic.

It must not reveal whether a user, workspace, membership, plan, or feature flag exists.

Recommended generic Swedish copy:

Du har inte behorighet att visa den har sidan.

## Basic Auth transition rule

Basic Auth must remain unchanged while workspace authorization is introduced.

Basic Auth transition must be planned separately after Better Auth session and workspace checks are verified.

## Non-goals

P23M does not:

- Add `src/lib/workspace-access.ts`.
- Modify `/dashboard`.
- Modify `/logga-in`.
- Modify `src/lib/auth-session.ts`.
- Modify middleware.
- Add redirects.
- Add database queries.
- Add workspace enforcement.
- Remove Basic Auth.
- Change database schema.
- Deploy.

## Risk notes

Risk 1: Session-only dashboard access is too weak.

Mitigation: add workspace membership checks before calling dashboard authorization complete.

Risk 2: Access-denied messages could leak account or workspace state.

Mitigation: use generic Swedish access-denied copy.

Risk 3: Basic Auth removal could expose dashboard too early.

Mitigation: keep Basic Auth until a dedicated transition phase.

## Recommended next phases

- P23N - Workspace access helper runtime draft.
- P23O - Dashboard workspace gate plan.
- P23P - Basic Auth transition plan.

## Validation

Because this phase is documentation-only, validation is:

- `git diff --check`
- `git status --short`

## Conclusion

P23M defines the workspace access helper plan.

No runtime behavior is changed in this phase.
