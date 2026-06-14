# Project Log

This file records what has been built and tested in Proffera.

## Phase 18.17B — Documentation workflow cleanup

Status: completed, merged through PR #12, and deployed successfully through Vercel.

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
