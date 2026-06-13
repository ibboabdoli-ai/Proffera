# Proffera Project Handoff

Project: Proffera
Repository: `ibboabdoli-ai/Proffera`
Stack: Next.js App Router, TypeScript, Tailwind, Neon/Postgres.
UI language: Swedish.

## Current status

The original MVP lead flow is working and must be protected.

Completed phases:

- Phase 07: Company registration
- Phase 08: Matching companies to leads
- Phase 10: Manual lead sending with mailto
- Phase 11: Outbox / delivery log
- Phase 11.1: Duplicate prevention for outbox logs
- Phase 12: Company approval and improved matching score
- Phase 12.1: Project memory system
- Phase 13: Admin cleanup
- Phase 13.1: Hide public chrome on admin pages
- Phase 14.3: Real lead email sending with Brevo
- Phase 15: Security cleanup and admin access hardening
- Phase 16.1: Public SaaS marketing foundation
- Phase 16.2: Legal pages
- Phase 16.3: Conversion sections and public-site cleanup
- Phase 16.4: Final public-site QA
- Phase 17.1: SaaS dashboard shell
- Phase 17.2: Dashboard module previews
- Phase 18.1B: Public branscher page
- Phase 18.1C: Booking/CRM migration taxonomy references
- Phase 18.2: Booking/CRM migration executed in Neon
- Phase 18.3: Demo CRM/booking seed executed in Neon
- Phase 18.4: Read-only dashboard DB connection for customers and bookings

## Product direction

Proffera is evolving from a lead/offert MVP into a Swedish SaaS platform for small service businesses.

Main SaaS modules:

- Leads
- Customers
- Bookings
- Analytics
- AI Assistant
- Settings

The service scope has expanded beyond cleaning/localvård into a broader booking-ready service taxonomy inspired by marketplace products such as Bokadirekt, but differentiated for Proffera as SaaS + booking + CRM + AI for Swedish service companies.

Current service taxonomy categories:

- Städning & lokalvård
- Flytt & hemservice
- Skönhet & hälsa
- Träning & friskvård
- Företagstjänster

Long-term planning docs:

- `docs/MASTER_PLAN.md`
- `docs/ROADMAP.md`
- `docs/DECISIONS.md`
- `docs/PROJECT_LOG.md`
- `docs/SERVICE_TAXONOMY_PLAN.md`
- `docs/PHASE_18_BOOKING_CRM_PLAN.md`
- `docs/PHASE_18_1C_TAXONOMY_MIGRATION_NOTES.md`
- `docs/PHASE_18_1D_SQL_EXECUTION_REVIEW.md`
- `docs/PHASE_18_2_NEON_EXECUTION_INSTRUCTIONS.md`
- `docs/PHASE_18_2_DB_STATE_AFTER_MIGRATION.md`
- `docs/PHASE_18_3_DEMO_SEED_INSTRUCTIONS.md`
- `docs/PHASE_18_3_DB_STATE_AFTER_SEED.md`

## Recent safe points

- Phase 16.1 docs point: `80c979f0a5111d72d8cd3ff6f1b20a7bfa34e867`
- Phase 16.2 docs point: `ba586900621f4191c48f9fac01619810a7e054b1`
- Phase 16.3 docs point: `37718cf23bea0de4ea62637d398efe9f561493ed`
- Phase 16.4 docs point: `1058dedbbfbec3a29a2efd6bf645bca4fa2f64f1`
- Phase 17.1 docs point: `59829df5980c8c672df5a8debcfdf4635aa780`
- Phase 17.2 docs point: `e1c4c000d3946636a73b3cac6810ecdb613aa780`
- Phase 18.1B docs point: `5baff9c5a67a831e17a2b0991a3593196c2f18ab`
- Phase 18.1C docs point: `286274889d7bd7fc74bd729a71c687f501123540`
- Phase 18.2 DB state docs point: `c9b6253125e0c0507bbcc6ba3b708cf3fcd2e88b`
- Phase 18.3 DB seed state docs point: `fdb8a808127092b8718870cb763f42672f11e9cf`
- Phase 18.4 read-only dashboard log point: `3b775806055e62dc2af8878597fa7cdee85ea470`

## Public SaaS routes

Currently built:

- `/`
- `/tjanster`
- `/branscher`
- `/priser`
- `/demo`
- `/om`
- `/kontakt`
- `/logga-in`
- `/integritetspolicy`
- `/villkor`
- `/cookies`
- `/robots.txt`
- `/sitemap.xml`

Public home page currently includes:

- SaaS hero
- Dashboard preview
- Benefits
- Service modules
- Pricing cards
- Trust indicators
- Case study placeholder
- Testimonials placeholder
- FAQ
- Demo CTA
- SaaS footer copy

`/branscher` currently shows:

- 5 main categories
- 21 services
- SaaS + booking + CRM + AI positioning
- CTA to book a demo

## SaaS dashboard routes

Currently built:

- `/dashboard`
- `/dashboard/leads`
- `/dashboard/kunder`
- `/dashboard/bokningar`
- `/dashboard/ai-assistent`
- `/dashboard/installningar`

Dashboard notes:

- Dashboard is separate from `/admin`.
- Public header and footer are hidden on `/dashboard` routes.
- `/dashboard/kunder` now reads real Neon data from `customers` in read-only mode.
- `/dashboard/bokningar` now reads real Neon data from `bookings` with customer data in read-only mode.
- `/dashboard/leads`, `/dashboard/ai-assistent` and `/dashboard/installningar` remain preview/static routes.
- No dashboard create/update/delete flows exist yet.
- Do not add write actions before a separate form, validation and rollback plan is reviewed.

Verified dashboard DB data:

- `/dashboard/kunder` shows `Demo Kund – Sara Andersson` from Neon.
- Customer stats show `Kontakter i CRM = 1`, `Aktiva kunder = 1`, `Prospekt = 0`.
- `/dashboard/bokningar` shows `Demo booking – Hemstädning` from Neon.
- Booking stats show `Bokningar i CRM = 1`, `Bekräftade = 1`, `Förfrågade = 0`, `Klara = 0`.

## Admin routes

Existing admin workflow routes:

- `/admin`
- `/admin/status`
- `/admin/foretag`
- `/admin/foretag/hantera`
- `/admin/matchning`
- `/admin/skicka-lead`
- `/admin/leverans`

Admin notes:

- Admin routes are protected by Basic Auth.
- Admin code must not be passed in URLs.
- Do not share admin secrets in chat, screenshots or docs.
- Confirm the admin access secret is rotated before broader use.

## Existing tested MVP flow

- Company registration works.
- Company approval and service editing works.
- Matching works by area, category, service and approved company status.
- Outbox duplicate prevention works.
- Brevo lead email sending works through `/admin/leverans`.
- Tested lead refs include `PRO-MQC5COT4-BL3RG` and `PRO-MQBD101M-6D6LO`.

## Database tables currently used

Existing lead/offert flow tables:

- `quote_requests`
- `company_registrations`
- `lead_outbox`

Booking/CRM MVP tables now created in Neon:

- `customers`
- `bookings`
- `customer_events`

Use Neon/Postgres. Do not switch to Supabase.

## Phase 18 database status

The Booking/CRM migration has been executed manually in Neon and verified.

Migration file:

- `db/migrations/20260613_phase18_booking_crm.sql`

Rollback notes:

- `db/migrations/20260613_phase18_booking_crm_rollback_notes.md`

Taxonomy notes:

- `docs/PHASE_18_1C_TAXONOMY_MIGRATION_NOTES.md`

Created tables:

- `customers`
- `bookings`
- `customer_events`

Verified table list after migration:

- `bookings`
- `company_registrations`
- `customer_events`
- `customers`
- `lead_outbox`
- `quote_requests`

Demo seed state:

- `customers_count = 1`
- `bookings_count = 1`
- `customer_events_count = 1`

Taxonomy strategy:

- Store `service_category_slug` and `service_slug` as soft references first.
- Do not create `service_categories` or `services` database tables until seed and admin-management planning is reviewed.

SQL review summary:

- Migration creates new SaaS CRM/booking tables only.
- It does not alter/drop existing MVP lead-flow tables.
- It is wrapped in `BEGIN` and `COMMIT`.
- `updated_at` has no auto-update trigger yet.
- `workspace_id` is still a simple text/default field and needs a stronger tenant model before real multi-tenant SaaS onboarding.

Important:

- Do not modify existing MVP tables without explicit migration and rollback plan.
- Do not add dashboard write actions before a separate validation, permission and rollback plan.
- Do not change admin, matching, outbox, Brevo or lead email workflows unless explicitly required.

## Email provider

Real lead email sending uses Brevo.

Required Vercel environment variables:

- `BREVO_API_KEY`
- `LEAD_FROM_EMAIL`

Current intended sender:

`Proffera <leads@proffera.se>`

Manual mailto fallback remains available in the admin UI.

## Workflow rules

- Keep rollback points before each phase.
- Keep changes small.
- Avoid unnecessary Vercel deploys.
- Do not expose environment variable values.
- Do not execute the full SaaS plan in one large prompt.
- Build phase by phase.
- `B` from the user means continue to the next planned step.

## Next recommended phase

Phase 18.5: Connect `/dashboard` overview stats to Neon read-only counts, or build read-only customer history details.

Do not modify existing lead, matching, outbox, Brevo or admin workflows without an explicit plan.
