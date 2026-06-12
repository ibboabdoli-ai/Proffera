# Proffera Project Plan

## Product vision

Proffera will be an original Swedish service marketplace where customers can submit service requests and compare offers from local companies. The platform is inspired by the general service-marketplace model, but must use its own brand, copy, layout, visual system, and product flows.

## Brand

- Working brand: Proffera
- Working slogan: Jämför offerter från lokala proffs
- Main language: Swedish
- Internal documentation language: English

## Initial market

- Country: Sweden
- First regions: Stockholm and Södertälje

## MVP scope

The MVP should include:

1. Public marketing pages
2. Customer service-request form
3. Provider/company application flow
4. Admin approval for providers
5. Lead/request storage
6. Category and region matching
7. Provider lead view
8. Provider offer submission
9. Customer offer comparison
10. Customer provider selection
11. Basic reviews after completed work
12. Basic legal/GDPR pages

## Non-MVP scope

The following should be postponed until after MVP validation:

- Paid lead system
- Provider subscriptions
- Stripe integration
- SMS notifications
- Internal chat
- AI lead scoring
- Advanced CRM pipeline
- Mobile app
- Advanced provider verification automation
- Multi-language support beyond Swedish

## Initial service categories

- Hemstädning
- Flyttstädning
- Kontorsstädning
- Fönsterputs
- Byggstädning
- Trädgård
- Flytthjälp
- Renovering

## User roles

1. Guest customer
2. Registered customer
3. Provider/company user
4. Admin

## Planned route map

### Public routes

- `/`
- `/sa-fungerar-det`
- `/kategorier`
- `/kategorier/[slug]`
- `/stad/[city]`
- `/skapa-uppdrag`
- `/foretag`
- `/anslut-foretag`
- `/om-oss`
- `/kontakt`
- `/villkor`
- `/integritetspolicy`

### Customer routes

- `/kund`
- `/kund/uppdrag`
- `/kund/uppdrag/[id]`
- `/kund/profil`

### Provider routes

- `/foretag/dashboard`
- `/foretag/leads`
- `/foretag/leads/[id]`
- `/foretag/offerter`
- `/foretag/profil`
- `/foretag/installningar`

### Admin routes

- `/admin`
- `/admin/uppdrag`
- `/admin/foretag`
- `/admin/kunder`
- `/admin/kategorier`
- `/admin/regioner`
- `/admin/offerter`
- `/admin/omdomen`
- `/admin/installningar`

## Technical architecture

Preferred stack:

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase PostgreSQL
- Prisma
- Zod
- React Hook Form
- Vercel

The stack must be confirmed in Phase 01 before implementation starts.

## Core flows

### Customer flow

1. Customer lands on the site.
2. Customer selects service category or starts from CTA.
3. Customer fills a multi-step request form.
4. Customer consents to privacy/contact terms.
5. System creates a service request.
6. Matching approved providers can see the request.
7. Providers submit offers.
8. Customer compares offers.
9. Customer selects provider.
10. Customer can review provider after completion.

### Provider flow

1. Provider applies to join.
2. Provider creates company profile.
3. Admin approves or rejects provider.
4. Approved provider sees matching leads.
5. Provider submits offers.
6. Provider tracks offer status.

### Admin flow

1. Admin views dashboard.
2. Admin reviews leads, providers, categories, regions, offers, reviews.
3. Admin approves/rejects providers.
4. Admin can update statuses and add notes.

## Phase plan

- PHASE 00 — Discovery and repository bootstrap
- PHASE 01 — Product blueprint and architecture
- PHASE 02 — Foundation setup
- PHASE 03 — Design system and layout
- PHASE 04 — Public marketing pages
- PHASE 05 — Lead/request form MVP
- PHASE 06 — Database integration
- PHASE 07 — Authentication and roles
- PHASE 08 — Provider onboarding
- PHASE 09 — Admin dashboard MVP
- PHASE 10 — Matching system MVP
- PHASE 11 — Offers/quotes MVP
- PHASE 12 — Reviews MVP
- PHASE 13 — Emails and notifications
- PHASE 14 — SEO and content scaling
- PHASE 15 — Security, GDPR, anti-spam
- PHASE 16 — QA, performance, accessibility
- PHASE 17 — Vercel deployment
- PHASE 18 — Launch checklist

## Risks

| Risk | Mitigation |
|---|---|
| Copying competitor UX/content too closely | Use original copy, layout, brand, and flows |
| Scope creep | Stop after every phase and require approval |
| Data privacy issues | Minimize data, add consent, document GDPR basics |
| Provider/customer access leakage | Add strict role-based access before private dashboards |
| Bad SEO from thin duplicate pages | Use unique Swedish copy and avoid generating low-value pages |
| Deployment instability | Deploy only after build/lint checks pass |

## Launch checklist

- [ ] MVP routes implemented
- [ ] Forms validated server-side
- [ ] Database migrations verified
- [ ] Auth and role protection verified
- [ ] Provider approval flow verified
- [ ] Lead matching verified
- [ ] Offer flow verified
- [ ] Legal pages reviewed
- [ ] Privacy consent implemented
- [ ] Build passes
- [ ] Lint passes
- [ ] Production deployment tested
- [ ] Rollback plan documented
