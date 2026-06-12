# Phase 11 Status

Phase: PHASE 11 Lead delivery log

Done:
- Added outbox log helpers.
- Added `/api/outbox` route.
- Added `/admin/leverans` page.

How to test:
- Create the `lead_outbox` table in Neon.
- Open `/admin/leverans`.
- Enter admin code.
- Click `Öppna mejl` if needed.
- Click `Markera som skickad`.
- Confirm the sent log appears under `Senaste loggar`.

Limitations:
- Still manual email sending.
- Log records manual sent status only.
- No provider delivery confirmation yet.
