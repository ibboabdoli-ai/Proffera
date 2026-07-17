# P93 — Admin workspace access

Date: 2026-07-17

## Outcome

Proffera admin can update the latest plan and base module access for each workspace from `/admin/foretag`.

## Included

- Select Starter, Professional, or Business.
- Select trialing, active, paused, past due, or cancelled plan status.
- Enable or disable online booking/QR and customer CRM/leads.
- Keep the AI assistant read-only and planned.
- Require an active or trialing latest plan before dashboard module flags grant access.
- Validate admin access, same-origin form submission, workspace UUID, plan and status on the server.

## Safety

- No Stripe integration was added.
- No database migration was needed.
- No customer, booking, or lead records are changed.
- `src/app/dashboard/ai-assistent/page.tsx` was not changed.

## Verification

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`

All checks passed locally.
