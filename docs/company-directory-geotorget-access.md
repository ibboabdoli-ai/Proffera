# Company Directory — Geotorget access runbook

## Goal

Enable the existing controlled 26-company geocoding pilot with Lantmäteriet **Belägenhetsadress Direkt v4.2**.

The application code is already designed to:

- process only the explicit 26-company pilot allowlist;
- reject Box/Kivra addresses;
- require a unique postcode + postort match;
- keep ambiguous addresses out of `company_directory_business_locations`;
- transform SWEREF 99 TM (EPSG:3006) to latitude/longitude through PostGIS;
- keep publication separate from geocoding.

## Official product

Product: **Belägenhetsadress Direkt**

Geotorget product page:

`https://geotorget.lantmateriet.se/geodataprodukter/belagenhetsadress-direkt-api`

Production API base URL:

`https://api.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2`

The product is currently free of charge, but access requires a legal review and product permission in Geotorget.

## Access steps

1. Create or sign in to a **Geotorget organisation account**.
2. Create/select a **PROD system account** for Proffera.
3. Open **Belägenhetsadress Direkt** in Geotorget.
4. Request API permission for the Proffera PROD system account.
5. Complete the legal-purpose review and accept the applicable terms.
6. After approval, use the **system account** username/password for Basic authentication. Do not use the personal Geotorget login in the application.

## Suggested purpose description

Use this as a starting point in the legal-purpose field and adjust only if the real usage changes:

> Proffera använder Belägenhetsadress Direkt för att geokoda verifierade företagsadresser i en svensk företagskatalog. Koordinaterna används för lokal sökning, avståndsberäkning och funktionen ”Nära mig”. Den första piloten omfattar endast ett begränsat antal aktiebolag och endast företagsadresser som redan finns i vår officiellt verifierade företagsprofil. Osäkra eller tvetydiga adresser lagras inte som koordinater och personuppgifter används inte för profilering eller direktmarknadsföring genom denna geokodningsfunktion.

## Vercel production secrets

After access is approved, configure the following **server-side** Production environment variables in the Proffera Vercel project:

```text
COMPANY_DIRECTORY_GEOCODING_ENABLED=true
LANTMATERIET_ADDRESS_API_USERNAME=<PROD system account username>
LANTMATERIET_ADDRESS_API_PASSWORD=<PROD system account password>
LANTMATERIET_ADDRESS_API_BASE_URL=https://api.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2
```

Never prefix the username/password variables with `NEXT_PUBLIC_` and never commit their values.

## Production readiness checklist

Before pressing **Geocode nästa 5** in Platform Admin:

- [x] Service + Location schema deployed
- [x] Nearby search merged
- [x] PostGIS installed in Production
- [x] Geocoding code merged and disabled by default
- [ ] Geotorget organisation account available
- [ ] Proffera PROD system account available
- [ ] Belägenhetsadress Direkt permission approved
- [ ] Vercel Production secrets configured
- [ ] `COMPANY_DIRECTORY_GEOCODING_ENABLED=true`

## Pilot execution

Once all checks are complete:

1. Open the internal Directory Search Pilot page as Super Admin.
2. Confirm the status pills show Lantmäteriet configured and PostGIS ready.
3. Run **Geocode nästa 5**.
4. Review successful / no-match / error counts.
5. Repeat until all safe matches are processed.
6. Review no-match records manually; do not invent coordinates.
7. Test `Rörmokare nära mig`, `Elektriker nära mig`, and the other pilot services before publishing any additional company profile.

## Publication invariant

Geocoding must never publish a company. Directory publication stays a separate explicit admin action, and auto-publish remains disabled during the pilot.
