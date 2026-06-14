# Project Log

This file records what has been built and tested in Proffera.

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

## Phase 17.1 — SaaS dashboard shell

Status: verified.

Built:

- Added `/dashboard` as a separate SaaS product dashboard preview route.
- Added dashboard shell with sidebar navigation and workspace preview.
- Added dashboard module routes for leads, customers, bookings, AI assistant and settings.
- Kept dashboard separate from the existing `/admin` workflow.
- Hid public header and footer on dashboard routes.

Tested:

- Production `/dashboard` renders the SaaS dashboard preview.
- Production module routes were confirmed working: `/dashboard/leads`, `/dashboard/kunder`, `/dashboard/bokningar`, `/dashboard/ai-assistent` and `/dashboard/installningar`.

Follow-up:

- Continue with Phase 17.2 for module table/card previews or Phase 18 for booking and CRM MVP.
- Do not connect dashboard shell to production database until a separate data plan is defined.
- Do not change existing admin, matching, outbox, Brevo or lead email workflows unless explicitly required.

## Phase 17.2 — Dashboard module previews

Status: verified.

Built:

- Replaced simple module placeholders with richer preview UI.
- Added lead table preview with status, source-like reference, value and next action.
- Added customer CRM card preview with contact status and notes.
- Added booking overview with weekday counts and day schedule.
- Added AI assistant conversation preview and intent breakdown.
- Added settings preview with company profile, services, notifications, AI response settings and form-like fields.
- Kept all dashboard module data as static UI preview data only.

Tested:

- Production `/dashboard/leads` shows the lead table preview.
- Production `/dashboard/kunder` shows customer CRM cards.
- Production `/dashboard/bokningar` shows booking overview and day schedule.
- Production `/dashboard/ai-assistent` shows AI conversation and intent preview.
- Production `/dashboard/installningar` shows settings cards and form preview.

Follow-up:

- Continue with Phase 18 only after defining a safe data model for bookings and CRM.
- Do not connect dashboard previews to production database without a separate data and rollback plan.
- Do not change existing admin, matching, outbox, Brevo or lead email workflows unless explicitly required.

## Phase 18.1B — Public branscher page

Status: verified.

Built:

- Added `/branscher` public page using the service taxonomy.
- Added Branscher to the public header navigation.
- Added Branscher to footer navigation.
- Added `/branscher` to `sitemap.xml` route generation.

Tested:

- Production `/branscher` renders the public branscher page.
- Header navigation shows the Branscher link.
- Vercel deployment for the sitemap update commit succeeded.

Notes:

- Sitemap route was added in code. The user pasted the `/branscher` page content rather than the raw sitemap XML.
- No database migration was executed.
- No admin, matching, outbox, Brevo or lead email workflow was changed.

Follow-up:

- Continue with a safe Phase 18 data step only after deciding whether service taxonomy should affect the database migration design.

## Phase 18.1C — Booking/CRM migration taxonomy references

Status: prepared and reviewed; not executed.

Built:

- Revised `db/migrations/20260613_phase18_booking_crm.sql` to include service taxonomy soft-reference columns.
- Added `primary_service_category_slug` and `primary_service_slug` to `customers`.
- Added `service_category_slug` and `service_slug` to `bookings`.
- Added service-related workspace indexes for customers and bookings.
- Added `docs/PHASE_18_1C_TAXONOMY_MIGRATION_NOTES.md`.

Reviewed:

- SQL creates only new SaaS CRM/booking tables: `customers`, `bookings`, `customer_events`.
- SQL does not alter or drop existing MVP tables: `quote_requests`, `company_registrations`, `lead_outbox`.
- SQL uses soft taxonomy references rather than creating taxonomy tables before seed/admin planning.
- Migration is wrapped in `BEGIN` and `COMMIT`.

Notes:

- The migration has not been run against Neon/Postgres.
- `updated_at` currently has no auto-update trigger; acceptable for first schema draft, but should be addressed before serious production use.
- `workspace_id` is currently a text/default field; multi-tenant workspace modeling should be revisited before paid SaaS onboarding.

Follow-up:

- Continue with Phase 18.1D SQL review before any manual database execution.
- Do not execute SQL until the user explicitly approves running it in Neon.
- Do not change admin, matching, outbox, Brevo or lead email workflows during SQL review.

## Phase 18.4 — Read-only dashboard DB connection

Status: verified.

Built:

- Added `src/lib/dashboard-db.ts` as a read-only Neon dashboard helper.
- Connected `/dashboard/kunder` to the `customers` table using read-only queries.
- Connected `/dashboard/bokningar` to the `bookings` table using read-only queries and customer joins.
- Kept `/dashboard/leads`, `/dashboard/ai-assistent`, `/dashboard/installningar`, `/admin`, Brevo, matching and outbox flows unchanged.

Tested:

- Production `/dashboard/kunder` renders real Neon data for `Demo Kund – Sara Andersson`.
- Production `/dashboard/kunder` shows `Kontakter i CRM = 1`, `Aktiva kunder = 1`, `Prospekt = 0`.
- Production `/dashboard/bokningar` renders real Neon data for `Demo booking – Hemstädning`.
- Production `/dashboard/bokningar` shows `Bokningar i CRM = 1`, `Bekräftade = 1`, `Förfrågade = 0`, `Klara = 0`.

Notes:

- This phase is read-only only: no insert, update or delete actions were added to dashboard routes.
- Demo data was seeded manually in Neon before dashboard verification.
- Existing MVP lead and delivery flows remain protected.

Follow-up:

- Continue with a small Phase 18.5 to connect `/dashboard` overview stats to Neon read-only counts, or keep the overview static and start customer-history read-only UI.
