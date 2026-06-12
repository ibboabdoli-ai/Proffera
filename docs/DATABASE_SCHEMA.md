# Database Schema Plan

This is the initial database schema plan for Proffera. It is not yet implemented.

## Status

- Current phase: PHASE 00
- Implementation status: planning only
- Database provider: proposed Supabase PostgreSQL
- ORM: proposed Prisma

## Core entities

### User

Represents an authenticated account.

Planned fields:

- id
- email
- role
- createdAt
- updatedAt

Roles:

- CUSTOMER
- PROVIDER
- ADMIN

### CustomerProfile

Represents customer-specific profile information.

Planned fields:

- id
- userId
- firstName
- lastName
- phone
- createdAt
- updatedAt

### ProviderProfile

Represents a provider user profile linked to a company.

Planned fields:

- id
- userId
- companyId
- position
- phone
- createdAt
- updatedAt

### Company

Represents a service provider company.

Planned fields:

- id
- name
- orgNumber
- contactEmail
- contactPhone
- description
- status
- website
- createdAt
- updatedAt

Statuses:

- pending
- approved
- rejected
- suspended

### Category

Represents service categories.

Planned fields:

- id
- name
- slug
- description
- isActive
- createdAt
- updatedAt

Initial categories:

- hemstadning
- flyttstadning
- kontorsstadning
- fonsterputs
- byggstadning
- tradgard
- flytthjalp
- renovering

### Region

Represents cities/regions where services are available.

Planned fields:

- id
- name
- slug
- county
- isActive
- createdAt
- updatedAt

Initial regions:

- Stockholm
- Södertälje

### CompanyCategory

Many-to-many relation between Company and Category.

Planned fields:

- companyId
- categoryId

### CompanyRegion

Many-to-many relation between Company and Region.

Planned fields:

- companyId
- regionId

### ServiceRequest

Represents a customer request/lead.

Planned fields:

- id
- customerId
- categoryId
- regionId
- city
- postalCode
- title
- description
- timing
- status
- contactName
- contactEmail
- contactPhone
- consentAccepted
- createdAt
- updatedAt

Statuses:

- draft
- submitted
- matched
- contacted
- quoted
- provider_selected
- completed
- cancelled

### ServiceRequestDetail

Flexible structured details depending on category.

Planned fields:

- id
- serviceRequestId
- dataJson
- createdAt
- updatedAt

### Match

Represents a matched provider for a service request.

Planned fields:

- id
- serviceRequestId
- companyId
- status
- createdAt
- updatedAt

Possible statuses:

- visible
- hidden
- contacted
- declined

### Offer

Represents a provider quote/offer.

Planned fields:

- id
- serviceRequestId
- companyId
- message
- estimatedPrice
- priceType
- availability
- terms
- status
- createdAt
- updatedAt

Statuses:

- sent
- viewed
- accepted
- rejected
- withdrawn

### Review

Represents a customer review after a completed job.

Planned fields:

- id
- serviceRequestId
- companyId
- customerId
- rating
- comment
- status
- createdAt
- updatedAt

Statuses:

- pending
- published
- rejected

### AdminNote

Internal admin notes.

Planned fields:

- id
- entityType
- entityId
- note
- authorId
- createdAt

### Notification

System notification records.

Planned fields:

- id
- userId
- type
- title
- body
- readAt
- createdAt

### AuditLog

Security and admin action log.

Planned fields:

- id
- actorUserId
- action
- entityType
- entityId
- metadataJson
- createdAt

## Privacy notes

- Store only necessary personal data.
- Use explicit consent for lead/contact forms.
- Keep admin access restricted.
- Do not expose customer contact details to providers before the chosen visibility rule is implemented.
- Add deletion/export process in later GDPR phase.

## Next database step

In Phase 01, confirm the schema and choose whether to implement with Supabase Auth + Prisma, Auth.js + Prisma, or another confirmed setup.
