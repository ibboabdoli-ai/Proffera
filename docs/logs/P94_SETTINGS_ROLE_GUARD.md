# P94 — Settings role guard

Date: 2026-07-17

## Outcome

Workspace roles now control access to dashboard Settings.

- Owner and admin roles see and can open Settings.
- Staff and viewer roles do not see Settings in desktop or mobile navigation.
- Direct access to `/dashboard/installningar` redirects unauthorized roles to the dashboard overview.
- Existing server-side guards on Settings mutations remain in place.

No database migration was required and the AI assistant page was not changed.
