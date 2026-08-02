# International B2B Billing

## Scope

Proffera sells its own SaaS subscription to businesses in Sweden, the supported
EU country list and the United Kingdom. This is not a marketplace or a Stripe
Connect flow.

## Workspace market model

Each workspace stores a market, business time zone, billing-currency preference
and optional VAT number. The application accepts only these combinations:

| Market | Currency preference |
| --- | --- |
| Sweden | SEK |
| Supported EU country | EUR |
| United Kingdom | GBP |

The time zone is a curated IANA zone chosen by the workspace. It controls how
local booking and staff-schedule inputs are interpreted; timestamps are stored
in UTC.

## Stripe behavior

- Hosted Checkout remains the authority for final amount, currency and tax.
- The configured Stripe subscription Price remains the source of truth.
- Do not hard-code or derive EUR/GBP amounts from a SEK price.
- `STRIPE_ADAPTIVE_PRICING_ENABLED=true` is an optional Stripe-account setting
  for eligible local-currency display. Leave it disabled until the Stripe
  account has been verified.
- Checkout collects billing address and VAT ID for B2B records.
- `STRIPE_TAX_ENABLED` must remain `false` until the applicable tax
  registrations are configured and business/legal review is complete.

## Migration and rollout

1. Validate `20260801_0020_workspace_market_settings.sql` in a temporary Neon
   branch.
2. Obtain explicit approval, apply it to production, and verify the result.
3. Deploy the matching application commit.
4. Test Stripe Sandbox/Preview for Sweden, an EU company and a UK company.
5. Record the results in `docs/TEST_CHECKLIST.md`.

## Non-goals

- This release does not make a tax determination or substitute for legal,
  accounting or VAT advice.
- It does not create additional Stripe Prices or turn on Stripe Tax by itself.
- It does not alter historic booking timestamps or customer data.
