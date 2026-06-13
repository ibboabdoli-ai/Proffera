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

Phase 16: Public SaaS marketing website.

Phase 16 must not touch the working lead flow, matching, outbox, admin security or Brevo email delivery unless explicitly required.
