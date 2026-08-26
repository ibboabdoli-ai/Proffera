# Bolagsverket API usage policy

This policy is binding for Proffera code that uses Bolagsverket APIs. It documents the safe runtime boundary for Company Directory ingestion, verification and future extensions.

## 1. Product separation

Bolagsverket products are not interchangeable. Code and configuration must preserve which product is being used and which terms/rate limits apply.

### Värdefulla datamängder

- Free product under the applicable terms.
- OAuth 2 authentication.
- HTTPS only.
- Keep usage below 60 requests/minute/user.
- Proffera uses this product for the automated Company Directory source and official company verification path unless another explicitly configured provider is selected.

### Full/paid företagsinformation

- Subject to the applicable contract, transaction terms and fees.
- OAuth 2 authentication, plus any stronger endpoint-specific authentication required by the product.
- HTTPS only.
- Keep usage below 20 requests/second/user.
- Do not reuse Värdefulla datamängder assumptions, credentials, quotas or licensing statements for this product.

## 2. Transport and credentials

- Bolagsverket token, source and detail endpoints must use HTTPS.
- URLs containing embedded username/password credentials are rejected.
- OAuth client secrets, bearer tokens and other credentials must remain server-side and must never be committed, logged or projected into client/public payloads.
- Do not send credentials to an endpoint before validating its URL and product configuration.

## 3. Rate limiting and concurrency

- Application code must not bypass the product-specific rate limits with parallel calls, retries or alternate credentials for the same user.
- The source adapter serializes data requests and applies provider-aware process-local spacing.
- The process-local limiter is a safety floor, not a distributed global quota. Schedulers, serverless concurrency and batch sizes must remain bounded so multiple instances cannot collectively exceed the upstream per-user limit.
- Retries must be bounded and must remain subject to the same rate-limit policy.
- Any future bulk/parallel redesign must prove aggregate per-user compliance before rollout.

## 4. Privacy and person data

- The automated public Company Directory path is for Swedish juridical-person companies, not personnummer/private-person lookup.
- Automated Bolagsverket detail verification may run for a known Swedish `juridical_person`, or for an `unknown` pre-classification discovery seed only when its Swedish 10-digit organisationsnummer has a company-shaped, non-personnummer identity. The detail response may then establish the legal form.
- Known sole traders, personnummer-shaped identifiers and other private-person identities remain blocked from automated detail/Official Facts lookup.
- Personnummer, firmatecknare or other person-linked fields available from a broader/paid API must not be added to public Directory, Marketplace outreach, SEO, public API or analytics merely because the upstream product exposes them.
- Any new processing of person-linked data requires a specific product need, GDPR/legal basis, data-minimization review, disclosure policy and tests before implementation.

## 5. Data use and provenance

- Bolagsverket-derived company information may be used within Proffera according to the applicable API/product terms.
- Preserve source/provenance so Bolagsverket, SCB, Lantmäteriet, owner and Proffera-derived fields are not silently conflated.
- Existing Company Directory publication/privacy/contact-entitlement gates remain authoritative. Official source availability does not itself authorize public disclosure of direct contact or personal data.
- Do not claim that Värdefulla datamängder is purely Bolagsverket-produced: the product can include data supplied by other authorities such as SCB; field provenance must remain accurate where known.

## 6. Failure behavior

- Insecure or malformed upstream URLs fail closed before a network request.
- Missing/invalid credentials or failed upstream verification must not cause guessed official facts to be published as verified data.
- Personnummer-shaped or otherwise ineligible identifiers fail closed before Bolagsverket detail/Official Facts network lookup.
- Rate-limit protection is part of the transport boundary and must remain covered by regression tests.
