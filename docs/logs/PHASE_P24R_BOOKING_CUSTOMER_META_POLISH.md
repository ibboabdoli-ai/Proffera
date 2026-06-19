# P24R — Booking customer meta polish

Status: PR ready.

## Scope

Small UI-only polish for the booking profile page.

## Built

- Updated `src/app/dashboard/bokningar/[id]/page.tsx`.
- Cleaned the linked customer meta row in `Bokningsprofil → Kopplad kund`.
- Removed the repeated customer service text from that compact meta row.
- Kept the booking service visible in the main booking details section.
- Kept the `Visa kundprofil` link unchanged.

## Safety

- No database change.
- No API change.
- No auth change.
- No migration.
- No production deploy requested.

## Validation

- GitHub diff review required.
- GitHub Actions CI should run on the PR.
- Local `npm run lint` and `npm run build` were not run because this execution mode has no local shell access.
