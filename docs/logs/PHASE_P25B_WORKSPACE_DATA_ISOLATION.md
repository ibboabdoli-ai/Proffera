# P25B — Workspace Data Isolation

Date: 2026-06-19

## Goal
Move Proffera dashboard customer and booking data access away from the hardcoded `default` workspace and scope reads/writes to the authenticated user's active workspace.

## Scope
Updated:
- `src/lib/dashboard-db.ts`
- `src/lib/dashboard-booking-status.ts`
- `src/app/dashboard/kunder/[id]/page.tsx`

Not changed:
- `src/app/dashboard/ai-assistent/**`
- database schema/migrations
- auth provider configuration
- public website UI

## Changes
- Dashboard stats, customer list, booking list, customer options, customer detail and booking detail now resolve the current workspace through `getUserWorkspaceAccess()`.
- Manual customer creation now inserts with the current workspace id.
- Manual booking creation now validates the selected customer inside the current workspace and inserts the booking with the current workspace id.
- Booking status updates now only match/update bookings inside the current workspace.
- Customer notes now insert history only when the customer belongs to the current workspace.
- Booking/customer joins now include workspace matching to avoid cross-workspace joins.

## Validation notes
- This was implemented through GitHub API mode, not local shell mode.
- Local `npm run lint` / `npm run build` were not run by the assistant.
- Validation must use PR diff, GitHub Actions CI and production smoke testing after merge.

## Risk
This change depends on valid workspace membership data for logged-in dashboard users. If a user has no active/trial workspace membership, dashboard data access returns empty/null or write actions fail safely.
