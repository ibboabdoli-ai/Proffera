# Proffera Current Status

Last updated: 2026-08-01

## Production baseline

Production deploys from `main`. The current production baseline is the merged
PrimeView portfolio release (`b1b4dab`). The next controlled release is
`work/proffera-international-billing`; it must not be deployed before its Neon
migration is verified and applied.

## Delivered product capabilities

- Swedish public routes remain canonical; English public marketing is available
  under `/en`, with language-aware metadata and sitemap entries.
- English dashboard navigation, booking/customer views, settings and billing
  are available through `?lang=en` without changing the underlying workspace.
- Gallery media is stored per workspace. The package lock now includes the
  Blob client required by the optional Blob upload path; database media remains
  the safe fallback.
- Stripe subscriptions use hosted Checkout, a customer portal and webhook-led
  entitlement synchronization. The two configured subscription Prices remain
  the source of truth.
- Booking reminders have a durable scheduler and duplicate-delivery protection.
  A real due reminder still needs operational verification before it is claimed
  as an end-to-end production success.

## Workspace access and tenant isolation

The application has session-derived workspace access with these roles:
`owner`, `admin`, `staff`, and `viewer`.

- Dashboard reads and writes resolve the active workspace from the authenticated
  membership, never from a route parameter or form field.
- Customer, booking, event, lead, status-update and rescheduling queries no
  longer include the retired legacy workspace fallback.
- The production database audit before this release found no customer or booking
  rows assigned to the retired `default` workspace.
- A live two-user sign-in smoke test remains a release verification step; it
  must use designated test accounts, never a real customer workspace.

## International B2B release (pending migration and deployment)

Migration: `db/migrations/20260801_0020_workspace_market_settings.sql`

Each workspace will have a controlled B2B market setting:

| Market | Currency preference | Booking and staff time |
| --- | --- | --- |
| Sweden | SEK | `Europe/Stockholm` by default |
| EU countries in the supported list | EUR | Workspace-selected supported IANA zone |
| United Kingdom | GBP | `Europe/London` by default |

- Existing workspaces stay Sweden-first by default.
- PrimeView Window Care is moved to the UK market by the migration. It has no
  booking records, so no historic appointment is reinterpreted.
- Public booking, schedule blocks, staff scheduling, calendar moves, booking
  notifications, reminders and customer booking pages use the workspace time
  zone after the migration.
- Checkout collects a billing address and VAT ID. The market and selected
  currency are recorded in Stripe metadata, and an old open Checkout session is
  expired if the workspace market changes.
- Proffera does not invent EUR or GBP amounts in application code. Hosted
  Checkout uses the configured Stripe Price; Adaptive Pricing is available only
  when `STRIPE_ADAPTIVE_PRICING_ENABLED=true` is verified in the Stripe account.
- `STRIPE_TAX_ENABLED` stays `false` until the business owner has configured
  and verified the required Stripe Tax registrations. A country selection or a
  VAT field alone is not legal/tax configuration.

See [International B2B billing](INTERNATIONAL_B2B_BILLING.md) for the release
decision and operational hand-off.

## Verification status for this release

- `npm test` — passing (45 tests)
- `npm run typecheck` — passing
- `npm run lint` — passing (four existing image-element warnings)
- `npm run build` — passing locally
- Neon migration — pending temporary-branch validation and explicit commit
  approval
- Production deployment and live checkout — not yet claimed or announced

## Remaining commercial prerequisites

1. Verify and apply the controlled Neon migration, then deploy the matching
   application commit.
2. Configure and test Stripe Adaptive Pricing only if local-currency display is
   wanted; otherwise Checkout safely uses the configured Price currency.
3. Obtain tax/legal review and configure the applicable Stripe Tax
   registrations before switching on automatic tax.
4. Run a Stripe Sandbox/Preview checkout for Sweden, an EU company and a UK
   company; verify that an open session is replaced after a market change.
5. Run the designated two-workspace authentication smoke test and confirm each
   account sees only its own customers, bookings and settings.
