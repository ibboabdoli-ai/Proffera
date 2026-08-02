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
- Live Stripe Price currency options are configured as follows. The amounts
  are managed in Stripe, not derived at runtime by application code.

| Plan | SEK/month | EUR/month | GBP/month |
| --- | ---: | ---: | ---: |
| Starter | 299 kr | €28 | £24 |
| Professional | 699 kr | €64 | £55 |

- All six current currency options use Stripe's `inclusive` tax behaviour.
  This does not enable automatic tax calculation.
- Manual EUR and GBP options take precedence over Adaptive Pricing for those
  currencies. `STRIPE_ADAPTIVE_PRICING_ENABLED` is therefore not required for
  Sweden, the supported EU countries, or the United Kingdom.
- Checkout collects billing address and VAT ID for B2B records.
- `STRIPE_TAX_ENABLED` must remain `false` until the applicable tax
  registrations are configured and business/legal review is complete.

## Migration and rollout

1. Validate `20260801_0020_workspace_market_settings.sql` in a temporary Neon
   branch.
2. Obtain explicit approval, apply it to production, and verify the result.
3. Deploy the matching application commit.
4. Start a non-completed Checkout session for Sweden, an EU company and a UK
   company, and confirm the final price shown by Stripe matches the intended
   currency option.
5. Record the results in `docs/TEST_CHECKLIST.md`.

## Non-goals

- This release does not make a tax determination or substitute for legal,
  accounting or VAT advice.
- It does not turn on Stripe Tax or substitute for tax registration.
- It does not alter historic booking timestamps or customer data.
