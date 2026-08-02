# Proffera Roadmap

## Current priority: controlled international B2B release

The release in `work/proffera-international-billing` prepares Proffera for
business customers in Sweden, the supported EU countries and the United
Kingdom without changing Swedish customer data or inventing subscription
prices.

1. Validate and apply `20260801_0020_workspace_market_settings.sql` through
   the Neon temporary-branch workflow.
2. Run the full local gate, create a focused PR, and deploy only the verified
   commit after the database migration is live.
3. Verify Sweden, EU and UK Checkout in Stripe Sandbox. Confirm that a market
   change expires an old open Checkout session.
4. Enable Stripe Adaptive Pricing only after it is verified in the Stripe
   account. Do not create application-side EUR/GBP price amounts by guesswork.
5. Keep automatic tax disabled until the required Stripe Tax registrations and
   business/legal review are complete.
6. Perform a designated two-workspace authentication smoke test and record the
   outcome in the release checklist.

## Completed foundations

- Swedish and English public marketing routes.
- English dashboard experience.
- Session-derived workspace membership and role checks.
- Workspace-scoped customers, bookings, leads, reminders, gallery and Stripe
  subscription data.
- Booking policies, staff planning and notification flows that can use a
  workspace time zone.

## Guardrails

- Never charge a currency or tax amount that is not configured and confirmed by
  Stripe Checkout.
- Do not turn on automatic tax based only on a country or VAT input.
- Do not use a customer workspace for access-control testing.
- Keep all dashboard reads and writes scoped by trusted session membership.
- Do not merge Service AI Chat or share its database with this project.
