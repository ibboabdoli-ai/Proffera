# P92 — Workspace module access guards

Status: implemented and locally verified; production verification pending.

## Scope

- Use existing `workspace_feature_flags` as the source of access decisions.
- Keep locked dashboard navigation items non-interactive and visibly marked `Låst`.
- Protect the complete Leads, Customers, and Bookings route trees, including detail and create pages.
- Keep the planned AI assistant preview unchanged.

## Outcome

- Added a fail-closed server-side module access check.
- Added one shared locked-module state with a link back to module status in Settings.
- Added nested route guards for `customer_crm` and `online_booking`.
- Passed real workspace module state from the dashboard server layout to desktop and mobile navigation.

## Verification

- `npm run lint` — passed.
- `npx tsc --noEmit` — passed.
- `npm run build` — passed.
- `git diff --check` — passed.
- `src/app/dashboard/ai-assistent/page.tsx` was not changed.

## Data and rollback

- No database schema or production data changes.
- No customer, lead, booking, plan, or feature flag was changed.
- Rollback is the single P92 commit/PR revert.

## Next safe step

Verify active access for Julius Salong in production and locked access using a dedicated test workspace. After that, plan a small Proffera-admin workflow for changing workspace plan/module access without adding Stripe.
