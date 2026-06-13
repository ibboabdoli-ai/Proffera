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

Tasks:

- Add customers table and customer admin UI.
- Add bookings table and booking admin UI.
- Add basic booking status workflow.
- Send booking confirmations through Brevo.
- Add simple customer history view.

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
