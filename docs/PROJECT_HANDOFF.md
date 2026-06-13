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

## Recent safe points

- Phase 16.1 docs point: `80c979f0a5111d72d8cd3ff6f1b20a7bfa34e867`
- Phase 16.2 docs point: `ba586900621f4191c48f9fac01619810a7e054b1`
- Phase 16.3 docs point: `37718cf23bea0de4ea62637d398efe9f561493ed`
- Phase 16.4 docs point: `1058dedbbfbec3a29a2efd6bf645bca4fa2f64f1`
- Phase 17.1 docs point: `59829df5980c8c672df5a8debcfdf4635aa6b66f`
- Phase 17.2 docs point: `e1c4c000d3946636a73b3cac6810ecdb613aa780`
- Phase 18.1B docs point: `5baff9c5a67a831e17a2b0991a3593196c2f18ab`

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

Preview-only product shell currently built:

- `/dashboard`
- `/dashboard/leads`
- `/dashboard/kunder`
- `/dashboard/bokningar`
- `/dashboard/ai-assistent`
- `/dashboard/installningar`

Dashboard notes:

- Dashboard is separate from `/admin`.
- Public header and footer are hidden on `/dashboard` routes.
- All dashboard module data is static preview data only.
- Phase 17.2 added richer previews for lead table, customer CRM cards, booking schedule, AI conversation and settings form.
- Do not connect dashboard previews to production database without a separate data model, migration and rollback plan.

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

- `quote_requests`
- `company_registrations`
- `lead_outbox`

Use Neon/Postgres. Do not switch to Supabase.

## Phase 18 database planning

A SQL migration file exists for early Booking/CRM planning, but it has not been executed against production database.

Migration file:

- `db/migrations/20260613_phase18_booking_crm.sql`

Rollback notes:

- `db/migrations/20260613_phase18_booking_crm_rollback_notes.md`

Important:

- Do not execute migration before reviewing service taxonomy impact.
- Do not modify existing MVP tables without explicit migration and rollback plan.
- Consider whether future tables need service category references before execution.

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

Phase 18.1C: Decide whether to revise the Booking/CRM migration to include service taxonomy references before executing any SQL.

Do not modify existing lead, matching, outbox, Brevo or admin workflows without an explicit plan.
