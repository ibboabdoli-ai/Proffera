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

- Legal copy is suitable for MVP but should be legally reviewed before broader public launch, paid subscriptions or larger-scale customer onboarding.
- Continue with Phase 16.3 for conversion sections and cleanup.

## Phase 16.3 — Conversion sections and public-site cleanup

Status: verified.

Built:

- Added reusable marketing conversion sections component.
- Added trust indicators to the home page.
- Added case study placeholder.
- Added testimonial placeholders.
- Added FAQ section.
- Added extra CTA section for booking a demo.
- Updated footer copy from offert-platform wording to SaaS positioning.

Tested:

- Production home page shows `Varför Proffera`, `Case study`, testimonial placeholders, `FAQ`, `Nästa steg` and updated SaaS footer copy.

Follow-up:

- Continue with Phase 16.4 for final public-site QA and small visual/copy cleanup.
- Do not touch admin, matching, outbox, Brevo or database flow during final public-site QA unless explicitly required.

## Phase 16.4 — Final public-site QA

Status: verified.

Built:

- Improved public login placeholder route for `/logga-in`.
- Added `/logga-in` to `sitemap.xml`.
- Confirmed public sitemap includes all current public SaaS, legal and login routes.

Tested:

- Production `sitemap.xml` renders valid XML.
- Sitemap includes `/`, `/tjanster`, `/priser`, `/demo`, `/om`, `/kontakt`, `/logga-in`, `/integritetspolicy`, `/villkor` and `/cookies`.
- Browser XML style warning was confirmed as normal and not an error.

Follow-up:

- Phase 16 public SaaS marketing website is complete enough for the next product phase.
- Continue with Phase 17 for SaaS dashboard shell.
- Do not change the working lead flow, matching, outbox, admin security, Brevo or database flow unless explicitly required.
