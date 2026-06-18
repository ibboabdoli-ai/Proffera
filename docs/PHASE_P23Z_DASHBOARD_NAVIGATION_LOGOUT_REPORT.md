# P23Z - Dashboard navigation and logout

## Goal
Make the authenticated dashboard navigation clearer and add a visible logout action.

## Changes
- Added active state to dashboard navigation links.
- Added aria-current for the active dashboard page.
- Added Logga ut button in the dashboard header.
- Uses Better Auth client signOut and redirects to /logga-in.
- Kept database, middleware, workspace gate, and API routes unchanged.

## Validation
- npm run lint passed.
- npm run build passed.
- git diff --check passed.

## Scope
No database changes.
No middleware changes.
No API changes.
No manual deploy.
