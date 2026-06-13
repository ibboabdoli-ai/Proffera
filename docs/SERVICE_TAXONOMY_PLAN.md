# Service taxonomy plan

## Purpose

Proffera should support a broader set of Swedish service businesses than only cleaning, while still keeping cleaning and local service as the first go-to-market segment.

This document defines the first service taxonomy for public content, dashboard previews, future search/category pages and later database seed data.

## Positioning

Proffera is not a copy of any booking marketplace. The product direction is:

- SaaS for Swedish service businesses.
- Booking, CRM, leads and AI-driven customer dialogue.
- Strong first focus on cleaning, local service and small companies.
- Later expansion into beauty, health, wellness and other appointment-based services.

## Current taxonomy file

Source file:

```text
src/lib/service-taxonomy.ts
```

The taxonomy currently contains these category groups:

1. Städning & lokalvård
2. Flytt & hemservice
3. Skönhet & hälsa
4. Träning & friskvård
5. Företagstjänster

## First market focus

The first commercial focus should remain:

- Hemstädning
- Kontorsstädning
- Flyttstädning
- Fönsterputs
- Lokalvård
- Flytthjälp
- Hemservice

These categories are closest to the original Iboren/cleaning-service direction and fit Proffera's lead, booking and CRM workflow.

## Expansion categories

The second expansion layer can include:

- Frisör
- Massage
- Naglar
- Fransar & bryn
- Hudvård
- Personlig tränare
- Yoga
- Naprapat
- Fotvård

These services usually need online booking, customer records, reminders and repeat visits, which fits the SaaS dashboard direction.

## Future database mapping

Do not run database migration only because this taxonomy exists.

When Phase 18 database work is approved, this taxonomy can map to future tables such as:

```text
service_categories
services
company_services
```

Recommended mapping:

```text
service_categories.slug = ServiceCategory.slug
service_categories.name = ServiceCategory.name
services.slug = ServiceItem.slug
services.name = ServiceItem.name
services.category_id = service_categories.id
```

## What not to do yet

- Do not automatically expose every category on the public website before copy and SEO structure are reviewed.
- Do not seed production database without a separate reviewed seed file.
- Do not change the existing quote request flow.
- Do not connect this taxonomy to admin, Brevo, matching or outbox in this phase.

## Next useful steps

1. Add a public `/branscher` page using this taxonomy.
2. Add selected category sections on `/tjanster`.
3. Add a read-only dashboard category preview.
4. Later, create safe seed SQL after migration review.
