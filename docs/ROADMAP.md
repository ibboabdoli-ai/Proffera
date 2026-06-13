# Roadmap

This roadmap defines the next planned phases for Proffera.

The working MVP lead flow is already in place. The next direction is to harden admin access, then turn Proffera into a sellable Swedish SaaS product for booking, leads, CRM and automation.

## Phase 15 — Security cleanup and admin access hardening

Goal: remove admin code exposure and make admin access safer.

Tasks:

- Rotate `ADMIN_ACCESS_CODE` in Vercel.
- Add admin login that sets a secure cookie.
- Stop passing the admin code in query strings.
- Update admin links and forms to rely on the cookie.
- Keep existing admin routes working.
- Test `/admin`, `/admin/status`, `/admin/foretag`, `/admin/matchning`, `/admin/skicka-lead` and `/admin/leverans`.

## Phase 16 — Public SaaS marketing website

Goal: make Proffera presentable and sellable as a SaaS product.

Pages:

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

Tasks:

- Add SaaS-style Swedish copy.
- Add service category sections.
- Add pricing plan cards for Starter, Professional and Business.
- Add demo previews for booking, customer page, admin dashboard, AI assistant and QR booking.
- Add CTA sections, FAQ, trust indicators and lead capture forms.
- Add metadata, Open Graph, canonical URLs, sitemap support and robots.txt.
- Keep current lead/company/admin/Brevo functionality untouched.

## Phase 17 — SaaS dashboard shell

Goal: evolve the current admin into a SaaS dashboard without breaking the MVP.

Tasks:

- Add dashboard navigation for Leads, Customers, Bookings, Analytics, AI Assistant and Settings.
- Keep current lead delivery and outbox pages available.
- Add placeholder views where the module is not implemented yet.
- Prepare component structure for future SaaS modules.

## Phase 18 — Booking and CRM MVP

Goal: add the first functional SaaS modules beyond lead matching.

Planning document:

- `docs/PHASE_18_BOOKING_CRM_PLAN.md`

Recommended order:

- Phase 18.0: Define data model, migration plan and rollback plan.
- Phase 18.1: Add isolated database migration for new tables only.
- Phase 18.2: Add read-only customer and booking dashboard views.
- Phase 18.3: Add create/update forms for customers and bookings.
- Phase 18.4: Add customer history timeline.
- Phase 18.5: Add booking status workflow.
- Phase 18.6: Add Brevo booking confirmations only after booking records are reliable.

Protected flows:

- Do not break existing quote request flow.
- Do not change existing matching logic without a separate plan.
- Do not alter `lead_outbox` behavior during early CRM work.
- Do not send booking emails automatically until the booking data model is tested.

## Phase 19 — AI assistant MVP

Goal: add AI-assisted communication in a controlled way.

Tasks:

- Add AI assistant preview page.
- Add configurable company knowledge/settings later.
- Add draft-first AI replies; do not send automatically.
- Keep human review before outbound communication.

## Phase 20 — Stripe subscriptions

Goal: turn Proffera into a paid SaaS product.

Tasks:

- Add Stripe checkout.
- Add subscription plans for Starter, Professional and Business.
- Store customer and subscription state.
- Add feature gating after billing is reliable.

## Later phases

- SMS reminders.
- Invoice generation.
- Employee scheduling.
- Customer portal.
- Mobile app.
- Third-party integrations.
