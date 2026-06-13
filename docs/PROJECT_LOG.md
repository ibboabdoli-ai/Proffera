# Project Log

This file records what has been built and tested in Proffera.

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

Tested:

- Project memory files were added to the repository.

## Phase 13 — Admin cleanup

Status: done.

Built:

- `/admin` now works as the central admin dashboard.
- Added workflow links to status, companies, company management, matching, lead sending and delivery log.
- Updated dashboard copy to describe the real workflow.
- Added approved request count.

Tested:

- Admin dashboard loaded successfully.
- Workflow cards were visible.
- Request table and stats were visible.

## Phase 13.1 — Hide public chrome on admin pages

Status: done.

Built:

- Added `AppShell` wrapper.
- Root layout now uses `AppShell`.
- Public header and footer are hidden on `/admin` routes.
- Public header and footer remain visible on public pages.

Tested:

- `/admin` no longer shows the public Proffera footer/header.

## Phase 14.3 — Real email sending with Brevo

Status: done.

Built:

- Switched real lead email sending from Resend to Brevo.
- Uses `BREVO_API_KEY` and `LEAD_FROM_EMAIL` server-side environment variables.
- Keeps the existing admin delivery workflow and manual mailto fallback.
- Outbox method can now record successful real sends via `brevo`.

Tested:

- Domain DNS records for `proffera.se` were added in Inleed.
- Brevo sender/domain setup was completed.
- A matched lead was sent from `/admin/leverans` using `Skicka via Proffera`.
- The delivery log showed `sent via brevo` for lead `PRO-MQC5COT4-BL3RG`.
