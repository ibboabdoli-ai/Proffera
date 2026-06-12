# Phase 01 Blueprint

## Phase goal

Define the product blueprint and architecture for Proffera before app implementation starts.

## Important boundary

Proffera should reach feature parity with a mature Swedish service marketplace, but it must remain an original product.

Allowed:

- Same type of marketplace functions
- Same high-level customer journey
- Same high-level provider journey
- Same business logic patterns
- Comparable trust, review, quote and lead-management features

Not allowed:

- Copying another brand
- Copying text
- Copying visual identity
- Copying page layout exactly
- Copying proprietary assets
- Copying code

## Feature parity target

### Public navigation

Planned main navigation:

- Få offerter
- Så fungerar det
- Kategorier
- Guider
- Anslut företag
- Logga in

Planned mobile navigation:

- Clear menu button
- Primary customer action
- Provider action
- Login action
- Category links

### Public pages

MVP public pages:

- Home
- How it works for customers
- How it works for companies
- Category overview
- Category detail pages
- City/region pages
- Provider landing page
- Guides/articles overview
- FAQ
- Contact
- Terms
- Privacy page

### Homepage sections

Planned homepage structure:

1. Hero with service search and category shortcuts
2. Trust benefits
3. Popular categories
4. How it works in three steps
5. Customer reviews summary
6. Provider verification summary
7. Popular guides
8. Local service areas
9. FAQ
10. Provider CTA
11. Footer

### Customer features

Required customer features:

- Submit a service request
- Multi-step request form
- Category-based questions
- Region and city selection
- Contact preference
- Consent checkbox
- Customer account or lightweight request access
- View own requests
- Compare offers
- View provider profiles
- Select provider
- Leave review after completed job

### Provider features

Required provider features:

- Apply to join
- Create company profile
- Select categories
- Select regions
- Add company description
- Add references and profile images later
- Add certificates and insurance details later
- Receive matching lead list
- Filter leads by category, region and size
- Send offer
- Track offer status
- Manage company profile
- View reviews
- Receive notifications later

### Admin features

Required admin features:

- Admin dashboard
- Manage service requests
- Manage provider applications
- Approve or reject providers
- Manage categories
- Manage regions
- Manage offers
- Manage reviews
- Add internal notes
- View activity history later

## User journeys

### Customer journey

1. Customer lands on Proffera.
2. Customer chooses a service category or starts a request.
3. Customer answers guided questions.
4. Customer submits contact details and consent.
5. Request is reviewed and published internally.
6. Matching approved providers can respond.
7. Customer receives offers or contact requests.
8. Customer compares price, message, profile, reviews and credentials.
9. Customer chooses a provider.
10. Customer can leave a review when the job is completed.

### Provider journey

1. Provider opens provider landing page.
2. Provider submits company application.
3. Admin reviews application.
4. Approved provider completes profile.
5. Provider receives relevant leads.
6. Provider sends an offer or marks lead as not relevant.
7. Provider manages offer pipeline.
8. Provider collects reviews from completed jobs.

### Admin journey

1. Admin logs in.
2. Admin checks new requests and provider applications.
3. Admin approves providers.
4. Admin monitors requests, offers and reviews.
5. Admin handles abuse, incorrect data and support cases.

## Role matrix

| Feature | Guest | Customer | Provider | Admin |
|---|---:|---:|---:|---:|
| View public pages | Yes | Yes | Yes | Yes |
| Submit request | Yes | Yes | No | Yes |
| View own request | Limited | Yes | No | Yes |
| View matching leads | No | No | Yes | Yes |
| Send offer | No | No | Yes | Yes |
| Select provider | No | Yes | No | Yes |
| Leave review | No | Yes | No | Yes |
| Manage provider profile | No | No | Yes | Yes |
| Approve provider | No | No | No | Yes |
| Manage categories | No | No | No | Yes |

## Route architecture

### Public

- `/`
- `/fa-offerter`
- `/sa-fungerar-det`
- `/kategorier`
- `/kategorier/[slug]`
- `/stad/[city]`
- `/guider`
- `/guider/[slug]`
- `/anslut-foretag`
- `/foretag/sa-fungerar-det`
- `/kontakt`
- `/faq`
- `/villkor`
- `/integritet`

### Customer

- `/kund`
- `/kund/uppdrag`
- `/kund/uppdrag/[id]`
- `/kund/offerter`
- `/kund/profil`

### Provider

- `/proffs`
- `/proffs/leads`
- `/proffs/leads/[id]`
- `/proffs/offerter`
- `/proffs/profil`
- `/proffs/omdomen`
- `/proffs/installningar`

### Admin

- `/admin`
- `/admin/uppdrag`
- `/admin/foretag`
- `/admin/kunder`
- `/admin/kategorier`
- `/admin/regioner`
- `/admin/offerter`
- `/admin/omdomen`
- `/admin/installningar`

## Data model updates

Phase 01 confirms these core models:

- User
- CustomerProfile
- ProviderProfile
- Company
- Category
- Region
- CompanyCategory
- CompanyRegion
- ServiceRequest
- ServiceRequestDetail
- LeadMatch
- Offer
- Review
- AdminNote
- Notification
- ActivityLog
- GuideArticle

## Status model

### Service request statuses

- draft
- submitted
- under_review
- published
- matched
- receiving_offers
- provider_selected
- completed
- cancelled

### Provider statuses

- pending
- approved
- rejected
- paused
- suspended

### Offer statuses

- sent
- viewed
- shortlisted
- accepted
- rejected
- withdrawn

### Review statuses

- pending
- published
- hidden

## Trust and safety features

MVP:

- Manual provider approval
- Company organization number field
- Contact consent
- Review moderation
- Basic abuse reporting later
- Admin-only provider approval

Post-MVP:

- Automated company checks
- Certificate uploads
- Insurance fields
- Review verification rules
- Anti-spam controls
- Audit trail

## UX principles

- Customer first
- Fast category selection
- Clear three-step explanation
- Mobile-first forms
- Large primary CTA
- Simple Swedish copy
- Strong trust signals
- Clear provider comparison
- No forced commitment for customer
- Provider dashboard focused on lead quality

## MVP implementation order

1. App foundation
2. Design system
3. Public pages
4. Customer request form
5. Data persistence
6. Basic account access
7. Provider application
8. Admin approval
9. Lead matching
10. Offer flow
11. Review flow
12. QA and deployment

## Phase 01 verification

- Product blueprint created.
- Feature parity target documented.
- Originality boundary documented.
- Route architecture drafted.
- Role matrix drafted.
- Status model drafted.
- No app implementation started.

## Next phase

PHASE 02 — Foundation setup.

Do not start Phase 02 without approval.
