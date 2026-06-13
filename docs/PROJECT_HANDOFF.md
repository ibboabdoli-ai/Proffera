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

## Project memory files

Read these files before starting new work:

- `docs/PROJECT_HANDOFF.md`
- `docs/PROJECT_LOG.md`
- `docs/ROADMAP.md`
- `docs/MASTER_PLAN.md`
- `docs/DECISIONS.md`

## Main admin routes

- `/admin`
- `/admin/status`
- `/admin/foretag`
- `/admin/foretag/hantera`
- `/admin/matchning`
- `/admin/skicka-lead`
- `/admin/leverans`

## Tested flow

A quote request was matched to one approved company.

The company was updated from a generic service value to real services:

`Fönsterputs, Lägenhet, Hemstädning, Flyttstädning`

The matching score reached `115` with these reasons:

`område, kategori, tjänst, godkänt företag`

The outbox log flow was tested. Duplicate prevention works and the UI shows one latest log per lead/company pair.

The admin dashboard was tested after cleanup. Public header and footer are hidden on admin routes.

Real lead sending was tested through Brevo. Lead `PRO-MQC5COT4-BL3RG` was sent from `/admin/leverans`, and the delivery log showed `sent via brevo`.

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

## Next recommended phase

Phase 15: Security cleanup and admin access hardening.

After Phase 15 is verified, continue with Phase 16: Public SaaS marketing website.
