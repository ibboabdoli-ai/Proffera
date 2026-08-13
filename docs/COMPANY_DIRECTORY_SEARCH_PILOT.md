# Company Directory Search Pilot

## Goal

Validate customer-style **Service + Location** search against safe internal Company Directory profiles before publishing a wider public directory.

## Internal preview

Route: `/admin/foretag/directory/search-preview`

The route is Super Admin only and intentionally searches `ready`/`published` profiles. It does not publish profiles or expose `ready` profiles publicly.

Default pilot query:

- Service: `Rörmokare`
- Location: `Stockholm`

The search resolver also understands customer-facing aliases such as `Elektriker`, `Städfirma`, `Målare`, `Snickare` and `Fönsterputs` through the normalized service taxonomy.

## Pilot selection rules

For the first location test, prefer profiles that are:

1. `ready`, active and not privacy-blocked;
2. high quality and aligned with their official activity description;
3. in Stockholm;
4. backed by a real street address, not only a Box/Kivra address;
5. distributed across VVS, Elektriker, Städning, Måleri and Snickeri.

## Nearby search gate

Do not show distance or `nära mig` until coordinates have a real geocoding source. The schema supports coordinates and service areas, but neither is guessed.

For Swedish authoritative address/geodata access, evaluate Lantmäteriet access separately. A geocoding provider must be explicitly chosen and configured before coordinates are written.

## Publication gate

This pilot does not change `COMPANY_DIRECTORY_AUTO_PUBLISH`. Wider public publication remains a separate decision after Service + Location search quality has been validated.
