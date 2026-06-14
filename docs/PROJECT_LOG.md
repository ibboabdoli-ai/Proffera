# Project Log

This file records what has been built and tested in Proffera.

## Phase 18.17B — Documentation workflow cleanup

Status: done. Merged to `main` through PR #12; Vercel deployment succeeded.

Details: `docs/logs/PHASE_18_17B_DOCUMENTATION_WORKFLOW_CLEANUP.md`

## 2026-06-14 — Documentation aligned with current SaaS direction

Status: documentation-only update.

Updated:

- Reframed Proffera as the parent SaaS product for Swedish service businesses.
- Documented Service AI Chat as a separate related engine under `chat.proffera.se`.
- Added the P-01 to P-05 widget/inbox integration strategy.
- Recorded the strict tenant-isolation rule: Iboren and Proffera data must never mix.
- Updated current phase status through verified Phase 18.14 and planned Phase 18.15.
- Recorded website/security audit notes, protected flows, rollback expectations, and documentation consistency fixes.

No application code, package files, database files, routes, components, or deployment state changed in this documentation update.

## Phase 07 — Company registration

Status: done.

Built:

- Company registration form.
- Company thank-you page.
- Admin company list.
- Database persistence through Neon/Postgres.

Tested:

- A company registration was created successfully.

## Phase 08 — Matching companies to leads

Status: done.

Built:

- Admin matching page.
- Matching by area, category, service and company status.

Tested:

- A lead was matched to a company by service area.

## Phase 10 — Manual lead sending

Status: done.

Built:

- Admin page for sending a matched lead.
- Manual mailto link for the matched company.

Tested:

- Email client opened with lead details.

## Phase 11 — Outbox log

Status: done.

Built:

- Outbox log table support.
- Admin delivery log page.
- Manual sent marker.

Tested:

- Sent log was created and displayed.

## Phase 11.1 — Duplicate prevention

Status: done.

Built:

- Duplicate check before saving an outbox row.
- Admin log list shows one latest row per lead/company pair.

Tested:

- Repeated clicks did not create visible duplicate logs.

## Phase 12 — Company approval and better scoring

Status: done.

Built:

- Company admin update route.
- Company management page.
- Status control for companies.
- Services editing for companies.

Tested:

- Company was approved.
- Company services were updated.
- Matching score increased to 115.

## Phase 12.1 — Project memory system

Status: done.

Built:

- Project handoff document.
- Project log.
- Roadmap.
- Architecture decision record cleanup.
