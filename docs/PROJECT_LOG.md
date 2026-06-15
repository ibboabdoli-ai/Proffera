# Project Log

This file records what has been built and tested in Proffera.

## P22A — Dashboard temporary Basic Auth

Status: done.

Details: `docs/logs/PHASE_P22A_DASHBOARD_TEMP_BASIC_AUTH.md`

Built:

- `/dashboard` and `/dashboard/*` now have temporary Basic Auth protection.
- Dashboard still returns `X-Robots-Tag: noindex, nofollow` after access is accepted.
- Admin protection, public pages, CRM/booking data access and Service AI Chat redirects were kept separate.
- No real customer authentication, session handling, roles or workspace binding was added.

Tested:

- Code inspection completed for middleware behavior.
- Local typecheck/lint/build were not run in this environment.
- Production route verification still needs manual check after deployment.

## P21 — Proffera login entry foundation

Status: done.

Details: `docs/logs/PHASE_P21_PROFFERA_LOGIN_ENTRY.md`

Built:

- Public `Logga in` now links to `/logga-in` inside Proffera.
- `/logga-in` no longer redirects to `chat.proffera.se`.
- `/logga-in` is a Proffera customer portal entry placeholder.
- No real authentication, session handling, billing, roles or workspace binding was added.

Tested:

- Code inspection completed for the changed files.
- Local typecheck/lint/build were not run in this environment.

## Phase 18.17B — Documentation workflow cleanup

Status: pending PR review.

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

## Planning update — SaaS master plan

Status: done.

Built:

- Added `docs/MASTER_PLAN.md`.
- Updated `docs/ROADMAP.md` for a phase-based SaaS buildout.
- Updated `docs/PROJECT_HANDOFF.md` with the new product direction.

Planned next sequence:

- Phase 15: Security cleanup and admin access hardening.
- Phase 16: Public SaaS marketing website.
- Phase 17: SaaS dashboard shell.
- Phase 18: Booking and CRM MVP.
- Phase 19: AI assistant MVP.
- Phase 20: Stripe subscriptions.

Notes:

- The SaaS plan must not be executed as one large change.
- Existing lead flow, matching, outbox and Brevo email flow must be protected during future phases.

## Phase 15 — Security cleanup and admin access hardening

Status: verified core flow.

Built:

- Added Basic Auth protection for admin routes.
- Admin links were cleaned so the admin code is no longer passed in public admin URLs.
- Main admin workflow pages were updated to work without `?code=` links.
- Existing Brevo delivery workflow was preserved.

Tested:

- Admin login works with Basic Auth.
- `/admin/leverans` loads after login.
- `Skicka via Proffera` still sends real lead emails through Brevo.
- Delivery log shows `sent via brevo` for both tested leads: `PRO-MQC5COT4-BL3RG` and `PRO-MQBD101M-6D6LO`.

Follow-up:

- Confirm `ADMIN_ACCESS_CODE` has been rotated in Vercel after the earlier URL exposure.
- Continue avoiding admin secrets in URLs.

## Phase 16.1 — Public SaaS marketing foundation

Status: verified home page.

Built:

- Repositioned public home page from an offert platform into a SaaS marketing page for Swedish service businesses.
- Added SaaS modules: leads, customers, bookings, analytics, AI assistant and settings.
- Added public pages for services, pricing, demo and about.
- Updated contact page for demo and pilot-customer interest.
- Added `robots.txt` and `sitemap.xml` metadata routes.
- Expanded root SEO metadata with canonical base, Open Graph metadata and Swedish SaaS keywords.

Tested:

- Production home page renders the new SaaS hero, dashboard preview, service modules, pricing cards and CTA sections.

Follow-up:

- Continue with Phase 16.2 for legal pages: Privacy Policy and Terms of Service.
- Do not change admin, matching, outbox, Brevo or database flow during legal-page work.

## Phase 16.2 — Legal pages

Status: verified.

Built:

- Replaced `/integritetspolicy` placeholder with a practical Swedish MVP privacy policy.
- Replaced `/villkor` placeholder with preliminary Swedish MVP terms.
- Replaced `/cookies` placeholder with Swedish cookie information.
- Added legal routes to `sitemap.xml`.

Tested:

- Legal pages deployed and were confirmed as working on production.

Follow-up:
