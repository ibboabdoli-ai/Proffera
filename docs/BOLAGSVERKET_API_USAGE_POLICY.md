# Bolagsverket API usage policy

Status: binding project policy for Proffera code that obtains, verifies, stores or publishes company information from Bolagsverket APIs. This document translates the applicable API rules into engineering controls; it does not replace Bolagsverket's current terms, contracts or product documentation.

## 1. Keep API products separate

Proffera must distinguish between the two relevant Bolagsverket API families instead of applying one product's limits/contract rules to the other.

### Värdefulla datamängder

- This is the current default Company Directory provider: `bolagsverket_vardefulla_datamangder`.
- Access is free and does not require a separate paid företagsinformation contract.
- Authentication uses OAuth 2/client credentials issued by Bolagsverket for the applicable environment.
- Requests must use HTTPS.
- Maximum use is 60 requests per minute per user. Proffera applies a conservative process-local spacing of at least 1.05 seconds between data requests.

### Full / paid företagsinformation API

- Use requires the applicable Bolagsverket agreement and transaction/payment terms.
- Authentication is OAuth 2 with Client ID/Client Secret for the ordinary API flow; an endpoint that explicitly requires stronger authentication such as mTLS must follow that endpoint's official contract.
- Requests must use HTTPS.
- Maximum use is 20 requests per second per user. Proffera applies a conservative process-local spacing of at least 55 ms when a provider is explicitly identified as the paid företagsinformation API.

Unknown/misclassified providers use the stricter Värdefulla datamängder spacing instead of failing open to the faster limit.

## 2. Credentials and transport

- Client IDs, client secrets, bearer tokens and any certificates/private keys are server-side secrets.
- Secrets must never be committed, logged, returned to clients, embedded in URLs, pasted into issues/PRs, or exposed through browser code.
- Token, source and detail endpoints must use HTTPS. URLs containing embedded username/password credentials are rejected.
- Test and Production credentials/endpoints must remain separated.
- A static bearer-token configuration is only an approved server-side operational fallback where explicitly configured; it does not change the product's authorization, privacy or rate-limit rules.

## 3. Rate limiting and concurrency

- Application code must not bypass the product-specific rate limits with parallel calls, retries or alternate credentials for the same user.
- The source adapter serializes data requests and applies provider-aware process-local spacing.
- The process-local limiter is a safety floor, not a distributed global quota. Schedulers, serverless concurrency and batch sizes must remain bounded so multiple instances cannot collectively exceed the upstream per-user limit.
- Retries must be bounded and must remain subject to the same rate-limit policy.
- Any future bulk/parallel redesign must prove aggregate per-user compliance before rollout.

## 4. Privacy and person data

- The automated public Company Directory path is for Swedish juridical-person companies, not personnummer/private-person lookup.
- Automated Bolagsverket detail verification may run only for a Swedish `juridical_person` with a valid 10-digit organisationsnummer.
- Sole traders and unknown/private identities may remain blocked/review records for safety, but the automated detail adapter must not turn them into a personnummer lookup or fetch extra personal data.
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
- A non-juridical-person candidate skips the automated detail lookup instead of falling back to a personal-identity query.
- Upstream errors must not expose secrets in logs or error payloads.

## 7. Required engineering checks

Any PR changing Bolagsverket-backed ingestion or verification must verify, where relevant:

1. OAuth/client credentials remain server-only and absent from logs/source/client payloads;
2. token/source/detail endpoints require HTTPS and reject embedded URL credentials;
3. the correct API family's rate limit is used: Värdefulla datamängder <= 60/minute/user, paid företagsinformation <= 20/second/user;
4. concurrency/retries cannot intentionally bypass the per-user limit;
5. automated detail lookup remains limited to Swedish juridical persons with 10-digit organisationsnummer;
6. personnummer/person-linked data is not introduced into public/automated flows without a separate approved privacy design;
7. existing publication, privacy, contact-entitlement and provenance rules remain intact;
8. tests cover insecure URLs and non-juridical-person fail-closed behavior.
