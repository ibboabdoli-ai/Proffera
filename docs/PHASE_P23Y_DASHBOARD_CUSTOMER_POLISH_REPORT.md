# P23Y — Dashboard customer polish

## Goal
Make the authenticated dashboard feel more like a real customer dashboard instead of a preview/read-only shell.

## Changes
- Replaced preview/read-only wording with customer-facing Swedish copy.
- Changed sidebar label from preview wording to "Kundportal".
- Changed header badge from "Preview-läge" to "Aktivt workspace".
- Replaced planned-module blocks with actionable quick links.
- Kept database, auth, workspace gate, middleware, and API routes unchanged.

## Validation
- npm run lint passed.
- npm run build passed.
- git diff --check passed.

## Scope
No database changes.
No auth changes.
No middleware changes.
No manual deploy.
