# Proffera Master Plan

This document defines the product direction for Proffera after the working lead/email MVP.

## Product position

Proffera will evolve from a simple lead/offert workflow into a Swedish SaaS platform for small service businesses.

Primary customer profile:

- Small cleaning, local service and appointment-based businesses in Sweden.
- Companies that need booking, lead handling, customer communication and simple automation.

Initial product promise:

- Get requests and bookings online.
- Manage leads and customers in one admin view.
- Send confirmations, reminders and follow-ups.
- Add AI-assisted communication when the core workflow is stable.

## Current confirmed MVP foundation

Already working:

- Quote request flow.
- Company registration.
- Company approval and service editing.
- Lead/company matching.
- Delivery/outbox log.
- Real lead email sending through Brevo.
- Manual mailto fallback.
- Neon/Postgres persistence.

Do not break these flows when building the SaaS layer.

## Product architecture direction

Public website:

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

Core SaaS modules:

- Leads
- Customers
- Bookings
- Analytics
- AI Assistant
- Settings

Service categories:

- Online Booking System
- AI Chat Assistant
- QR Booking
- Website Creation
- Lead Management
- Customer CRM
- Automated Email Confirmations
- Appointment Reminders
- Digital Forms
- Business Automation

## Pricing direction

Starter:

- Booking system
- Email notifications
- Contact forms

Professional:

- Booking system
- AI chatbot
- CRM
- Analytics

Business:

- Everything included
- Priority support
- Multi-location support
- Custom integrations

Pricing should be presented before Stripe is implemented. Stripe should come only after the offer and product packaging are clear.

## Phased execution plan

### Phase 15 — Security cleanup and admin access hardening

Goal: remove admin code from URLs and reduce accidental exposure.

Scope:

- Rotate `ADMIN_ACCESS_CODE` in Vercel.
- Add cookie-based admin login.
- Stop passing `code` through admin links and forms.
- Keep rollback point before code changes.

### Phase 16 — Public SaaS marketing website

Goal: make Proffera sellable before adding complex SaaS logic.

Scope:

- Add public pages listed above.
- Add Swedish SaaS copy.
- Add strong CTA sections.
- Add pricing cards.
- Add demo sections and dashboard previews.
- Add FAQ, trust indicators and simple case-study blocks.
- Add privacy and terms pages.
- Add metadata, canonical URLs, sitemap and robots support.

Do not touch lead flow, matching, outbox, database logic or Brevo integration in this phase.

### Phase 17 — SaaS dashboard shell

Goal: restructure admin toward a product dashboard without breaking the current MVP.

Scope:

- Add dashboard navigation for Leads, Customers, Bookings, Analytics, AI Assistant and Settings.
- Keep existing admin pages available.
- Move current lead delivery workflow under Leads/Delivery when safe.

### Phase 18 — Booking and CRM MVP

Goal: add the first real SaaS functionality beyond lead/offert matching.

Scope:

- Booking entity schema.
- Customer entity schema.
- Booking list and customer list.
- Basic booking create/update/status flow.
- Email confirmation through Brevo.

### Phase 19 — AI assistant MVP

Goal: add controlled AI-assisted communication.

Scope:

- AI assistant preview first.
- Saved knowledge/settings per company later.
- No autonomous sending before review workflow exists.

### Phase 20 — Stripe subscriptions

Goal: convert Proffera into a paid SaaS.

Scope:

- Stripe customer and subscription tables.
- Checkout for Starter, Professional and Business.
- Subscription status in admin.
- Feature gating after billing is reliable.

## Technical rules

- Use Next.js App Router and TypeScript.
- Use Neon/Postgres.
- Do not use Supabase.
- Keep changes small and phase-based.
- Do not expose environment variable values.
- Avoid unnecessary Vercel deploys.
- Verify each phase before starting the next.

## Future roadmap ideas

- SMS reminders.
- Invoice generation.
- Employee scheduling.
- Customer portal.
- Mobile app.
- Third-party API integrations.
