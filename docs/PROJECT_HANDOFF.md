# Proffera Project Handoff

Project: Proffera
Repository: `ibboabdoli-ai/Proffera`
Stack: Next.js App Router, TypeScript, Tailwind, Neon/Postgres.
UI language: Swedish.

## Status

The MVP lead flow is working.

Completed:

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

## Product direction

Proffera is evolving from a lead/offert MVP into a Swedish SaaS platform for small service businesses.

The long-term product direction is documented in:

- `docs/MASTER_PLAN.md`
- `docs/ROADMAP.md`

Primary SaaS modules planned:

- Leads
- Customers
- Bookings
- Analytics
- AI Assistant
- Settings

Public SaaS pages planned:

- Home
- Services
- Pricing
- Demo
- Industries
- About
- Contact
- Blog
- Privacy Policy
- Terms of Service

## Safe points

Before Phase 12:

`4ed3e4feddc427a110df48104db910c3633fb692`

Safe point after Phase 12:

`d8bab25913c1c9b8dd60f77d48d2e88b16be28bd`

Before Phase 13:

`edf8e00cac6f70b98d1d9c1f2a915cd509a11dfb`

Phase 13 code safe point:

`063ff9da3f3e19d5f9b59bad0dad9c4bc2393464`

Phase 13.1 code safe point:

`f5ad98c81710ae19564a4d54a34d95069b6189f0`

Phase 14.3 tested docs point:

`579390cb449a82272f358c469bf9265399beb243`

Phase 14.3 handoff point:

`c09bf8ed7e734f32cdd10e48c8427da81eabcf24`

SaaS master plan docs point:

`3abcf6baaf0567f9484eb9f073ef7beeafe514c0`

Phase 15 security verification docs point:

`f9863e5b12e9761263f7738d1096298ffb3183f7`

Phase 16.1 marketing foundation docs point:

`80c979f0a5111d72d8cd3ff6f1b20a7bfa34e867`

Phase 16.2 legal pages docs point:

`ba586900621f4191c48f9fac01619810a7e054b1`

Phase 16.3 conversion cleanup docs point:

`37718cf23bea0de4ea62637d398efe9f561493ed`

Phase 16.4 final public QA docs point:

`1058dedbbfbec3a29a2efd6bf645bca4fa2f64f1`

## Project memory files

Read these files before starting new work:

- `docs/PROJECT_HANDOFF.md`
- `docs/PROJECT_LOG.md`
- `docs/ROADMAP.md`
- `docs/MASTER_PLAN.md`
- `docs/DECISIONS.md`

## Public SaaS pages

Currently built:

- `/`
- `/tjanster`
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

Public home sections currently include:

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

Sitemap currently includes:

- `/`
- `/tjanster`
- `/priser`
- `/demo`
- `/om`
- `/kontakt`
- `/logga-in`
- `/integritetspolicy`
- `/villkor`
- `/cookies`

## Main admin routes

- `/admin`
- `/admin/status`
- `/admin/foretag`
- `/admin/foretag/hantera`
- `/admin/matchning`
- `/admin/skicka-lead`
- `/admin/leverans`

## Admin security

Admin routes are protected by Basic Auth.

Current admin login behavior:

- Username can be any non-empty value, commonly `admin`.
- Password is the Vercel `ADMIN_ACCESS_CODE` value.
- Admin code should not be passed in URLs.

Follow-up security requirement:

- Confirm `ADMIN_ACCESS_CODE` has been rotated in Vercel after the earlier URL exposure.
- Do not share the admin code in chat or screenshots.

## Tested flow

A quote request was matched to one approved company.

The company was updated from a generic service value to real services:

`Fönsterputs, Lägenhet, Hemstädning, Flyttstädning`

The matching score reached `115` with these reasons:

`område, kategori, tjänst, godkänt företag`

The outbox log flow was tested. Duplicate prevention works and the UI shows one latest log per lead/company pair.

The admin dashboard was tested after cleanup. Public header and footer are hidden on admin routes.

Real lead sending was tested through Brevo. Leads `PRO-MQC5COT4-BL3RG` and `PRO-MQBD101M-6D6LO` were sent from `/admin/leverans`, and the delivery log showed `sent via brevo`.

Phase 15 Basic Auth was tested. Admin login worked, `/admin/leverans` loaded after login, and Brevo delivery still worked.

Phase 16.1 public home page was tested on production. It shows the SaaS hero, dashboard preview, service modules, pricing cards and CTA sections.

Phase 16.2 legal pages were tested on production. `/integritetspolicy`, `/villkor` and `/cookies` are available with Swedish MVP legal copy.

Phase 16.3 home page was tested on production. It shows `Varför Proffera`, case study placeholder, testimonial placeholders, FAQ, `Nästa steg` and updated SaaS footer copy.

Phase 16.4 public-site QA was tested on production. `sitemap.xml` renders valid XML and includes the current public routes including `/logga-in` and legal pages. The browser XML style warning is normal.

## Database tables currently used

- `quote_requests`
- `company_registrations`
- `lead_outbox`

## Email provider

Real lead email sending uses Brevo.

Required Vercel environment variables:

- `BREVO_API_KEY`
- `LEAD_FROM_EMAIL`

Current intended sender:

`Proffera <leads@proffera.se>`

Manual mailto fallback remains available in the admin UI.

## Important notes

- Use Neon/Postgres, not Supabase.
- Keep changes small.
- Keep rollback points before each phase.
- Avoid unnecessary Vercel deploys.
- Do not expose environment variable values.
- Some long documentation or migration payloads may be blocked by safety checks; do not retry blocked payloads repeatedly.
- The admin code was exposed in a shared URL during testing. Rotate `ADMIN_ACCESS_CODE` before broader use.
- Do not execute the full SaaS plan in one large agent prompt. Build it phase by phase.
- Legal copy is MVP-level and should be reviewed before wider commercial launch.
- `B` from the user means continue to the next planned step.

## Next recommended phase

Phase 17: SaaS dashboard shell.

Phase 17 should start the authenticated/product dashboard foundation for the SaaS direction. It must not break the existing lead flow, matching, outbox, admin security, Brevo email delivery or current public pages.
