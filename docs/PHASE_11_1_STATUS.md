# Phase 11.1 Status

Phase: PHASE 11.1 Prevent duplicate delivery logs

Done:
- Added duplicate check before inserting into `lead_outbox`.
- Existing log is reused when the same lead and company email already exists.
- Admin log list now displays one latest row per lead/company email.

Test:
- Open `/admin/leverans`.
- Click `Markera som skickad` multiple times for the same company.
- Confirm the visible log list does not add duplicates.

Optional database hardening:
- Add a unique index later after cleaning old duplicate rows.
