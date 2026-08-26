# Company Directory — Geotorget access runbook

## Goal

Use Lantmäteriet's official address APIs for a controlled Company Directory geocoding flow:

1. **Referens Uppslag Adress v3** resolves address text to a register-unit reference (UUID).
2. **Belägenhetsadress Direkt v4.2** reads the referenced official address and SWEREF 99 TM point.

The application code is designed to:

- process only the explicit 26-company pilot allowlist;
- reject Box/Kivra addresses;
- keep ambiguous addresses out of `company_directory_business_locations`;
- verify exact street + postcode + postort against Belägenhetsadress before accepting coordinates;
- transform SWEREF 99 TM (EPSG:3006) to latitude/longitude through PostGIS;
- keep publication separate from geocoding.

## Official products

### Referens Uppslag Adress v3

Purpose: address text → register-unit reference.

Production API base URL:

`https://api.lantmateriet.se/distribution/produkter/uppslag/adress/v3`

The v3 free-text endpoint is:

`/fritext?adress=<address>`

### Belägenhetsadress Direkt v4.2

Purpose: authoritative address detail + SWEREF point for the selected reference.

Production API base URL:

`https://api.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2`

Both products are currently free of charge, but each requires legal review and product permission in Geotorget.

## Access steps

1. Create or sign in to a **Geotorget organisation account**.
2. Create/select a **PROD system account** for Proffera.
3. Request **Referens Uppslag Adress v3** permission for that system account.
4. Request **Belägenhetsadress Direkt v4.2** permission for the same system account.
5. Complete the legal-purpose reviews and accept the applicable terms.
6. After approval, use the **system account** username/password for Basic authentication. Do not use the personal Geotorget login in the application.

## Production configuration

Configure the following **server-side** Production environment variables in the Proffera Vercel project:

```text
COMPANY_DIRECTORY_GEOCODING_ENABLED=true
LANTMATERIET_ADDRESS_LOOKUP_API_BASE_URL=https://api.lantmateriet.se/distribution/produkter/uppslag/adress/v3
LANTMATERIET_ADDRESS_API_BASE_URL=https://api.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2
LANTMATERIET_ADDRESS_API_USERNAME=<PROD system account username>
LANTMATERIET_ADDRESS_API_PASSWORD=<PROD system account password>
```

The lookup base URL is optional in runtime configuration because the application has the production v3 URL as its fail-closed default. Keep the explicit value in Vercel when operational visibility is useful.

Never prefix the username/password variables with `NEXT_PUBLIC_` and never commit their values.

## Current access checklist

- [x] Service + Location schema deployed
- [x] Nearby search merged
- [x] PostGIS installed in Production
- [x] Geotorget organisation account available
- [x] Proffera PROD system account available
- [x] Referens Uppslag Adress v3 permission approved
- [x] Belägenhetsadress Direkt v4.2 permission approved
- [ ] Verify Vercel Production credentials/configuration
- [ ] Verify the two-step lookup against Production with a known address
- [ ] Run the controlled Directory pilot and review no-match records

## Pilot execution

Once the Production configuration checks are complete:

1. Open the internal Directory Search Pilot page as Super Admin.
2. Confirm the status pills show Lantmäteriet configured and PostGIS ready.
3. Run **Geocode nästa 5**.
4. Review successful / no-match / error counts.
5. Repeat until all safe matches are processed.
6. Review no-match records manually; do not invent coordinates.
7. Test `Rörmokare nära mig`, `Elektriker nära mig`, and the other pilot services before publishing any additional company profile.

## Publication invariant

Geocoding must never publish a company. Directory publication stays a separate explicit admin action, and auto-publish remains disabled during the pilot.
