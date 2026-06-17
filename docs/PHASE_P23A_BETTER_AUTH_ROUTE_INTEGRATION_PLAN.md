# P23A — Better Auth route integration plan

Status: planned  
Date: 2026-06-17  
Type: documentation only  
Runtime changes: none  
Database changes: none  
Deployment: none  

## Purpose

This document defines the safe integration plan for connecting Better Auth routes to the Proffera application after the completed P22K database migration.

P23A does not add route handlers, does not change login behavior, does not remove Basic Auth, and does not deploy.

## Current state

The Better Auth foundation exists in:

`src/lib/auth.ts`

Current auth status:

`configured-not-routed`

The production database now has the required Better Auth and workspace schema tables after P22K.

The public `/logga-in` page is still a placeholder page for future customer access.

The dashboard is still protected by temporary Basic Auth through middleware.

## Current protected areas

The current middleware protects or redirects these areas:

- `/dashboard`
- `/dashboard/*`
- `/admin/*`
- `/api/outbox`
- `/api/company-admin`
- `/app/*`
- `/api/widget-config`

P23A does not change this behavior.

## Target architecture

The intended future auth architecture is:

1. Keep Better Auth initialization isolated in `src/lib/auth.ts`.
2. Add a Better Auth route handler under the Next.js App Router.
3. Keep `/logga-in` as the user-facing login entry point.
4. Add safe login form behavior in a later phase.
5. Add session lookup helper in a later phase.
6. Add workspace membership lookup in a later phase.
7. Replace temporary Basic Auth only after real session and role checks are verified.

## Proposed future phases

### P23B — Auth route handler draft

Add the minimal Better Auth API route handler.

Expected scope:

- Add auth route handler only.
- No login UI changes.
- No dashboard access changes.
- No Basic Auth removal.
- No deployment unless explicitly approved.

### P23C — Auth route smoke check

Verify that the auth route exists and responds safely.

Expected scope:

- Local build.
- Local route shape check if possible.
- No user creation.
- No production data mutation.

### P23D — Login UI wiring plan

Plan how `/logga-in` should connect to Better Auth.

Expected scope:

- Swedish login UX plan.
- Error states.
- No real form submission yet.

### P23E — Login UI minimal patch

Add a minimal login form only after route behavior is verified.

Expected scope:

- No dashboard access switch yet.
- No Basic Auth removal.

### P23F — Session helper plan

Define server-side helpers for reading the current auth session.

Expected scope:

- Plan only.
- No dashboard enforcement change.

### P23G — Workspace membership access plan

Define how auth users connect to Proffera workspaces.

Expected scope:

- Role model.
- Membership lookup.
- Access decisions.
- No enforcement yet.

### P23H — Dashboard auth transition plan

Plan the future transition from Basic Auth to Better Auth session and role checks.

Expected scope:

- Keep rollback path.
- Keep Basic Auth until real auth is proven.
- No immediate removal.

## Required safety rules

All future P23 phases must follow these rules:

- Do not print secrets.
- Do not commit `.env*`.
- Do not commit `.vercel`.
- Do not commit `node_modules`.
- Do not run destructive database commands.
- Do not remove Basic Auth until replacement auth is verified.
- Do not change dashboard access and auth route behavior in the same patch.
- Do not deploy unless explicitly required and approved.

## Required validation before implementation

Before adding a real Better Auth route handler, verify:

- Current Better Auth package version.
- Correct Next.js route handler API for the installed Better Auth version.
- Current App Router structure.
- Build behavior.
- Environment variables required by Better Auth.
- Local behavior without exposing secrets.

## Non-goals for P23A

P23A does not:

- Add auth API routes.
- Add login form submission.
- Create users.
- Create sessions.
- Modify database schema.
- Run migrations.
- Remove Basic Auth.
- Change dashboard protection.
- Deploy manually.

## Conclusion

P23A is a planning-only phase.

The correct next implementation step is P23B, which should add only the minimal Better Auth route handler after the route API is verified.
