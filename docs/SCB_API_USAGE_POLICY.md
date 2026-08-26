# SCB API usage policy

Status: binding project policy for Proffera code that reads, stores, transforms, displays, exports, or uses data from Statistiska centralbyrån (SCB) company/workplace APIs.

Basis: SCB `Användarvillkor API-tjänst` accepted for the service, together with SCB's API variable description. This document translates those conditions into engineering rules; it is not a replacement for the signed terms.

## 1. Certificate and transport

- SCB access must use HTTPS and the certificate issued for the specific SCB user.
- The certificate, PFX bytes/Base64 and passphrase are secrets. They must never be committed, logged, pasted into tickets/PRs, returned to clients, or shared with another user.
- Secrets must be supplied through approved server-side environment configuration only.
- Client/browser code must never receive SCB credentials.

## 2. API limits

- Never exceed 10 SCB requests per 10 seconds for the SCB user.
- The current transport spacing is a safety control and must not be relaxed beyond the contractual limit.
- Never request more than 2,000 rows in one API response.
- Any future non-exact or bulk flow must count/chunk the workload before fetching so the 2,000-row limit cannot be exceeded.
- Retries must remain bounded and rate-limited.

## 3. Source attribution

When SCB-derived data is published, exported, displayed or otherwise made available outside internal processing:

- identify the source as `SCB` or `Statistiska centralbyrån`;
- in an international/English context, `Statistics Sweden` may be used;
- when Proffera has selected, combined, normalized, geocoded, classified or otherwise processed the source data, state that own processing has been performed (`egen bearbetning`, or equivalent wording such as `Processed by Proffera`).

Do not label Bolagsverket-, owner-, Lantmäteriet- or Proffera-originated fields as SCB data. Attribution must follow actual provenance.

## 4. GDPR and person data

- Proffera is responsible for lawful processing of personal data received through the SCB service.
- Company Directory / automated Marketplace outreach must remain limited to safe juridical-person flows. Personnummer and sole-trader/private-person data must not be introduced into the existing automatic Directory outreach path.
- Minimize personal data and do not expose fields merely because SCB makes them technically available.

## 5. Reklamspärr / marketing restrictions

SCB's `Reklam` variable is a marketing restriction signal and must be enforced before outreach. In the current Proffera data model, the canonical enforcement input is `company_directory_official_facts.advertising_blocked`.

SCB documents these values:

- `11`: receives advertising; telephone not blocked.
- `12`: receives advertising; telemarketing telephone blocked.
- `13`: receives advertising; NIX telephone restriction.
- `21`: has declined advertising; telephone not otherwise blocked.
- `22`: has declined advertising; telemarketing telephone blocked.
- `23`: has declined advertising; NIX telephone restriction.

Operational Proffera policy:

- `21`, `22`, `23` are hard marketing opt-outs.
- Telephone marketing must also respect the telephone restrictions represented by `12`, `13`, `22`, `23`.
- Automated Marketplace outreach is stricter and fail-closed: it may proceed only when the canonical official-facts value `advertising_blocked` is explicitly `false`.
- `advertising_blocked = true` blocks automated outreach.
- Missing/unknown advertising status also blocks automated outreach until it is verified.
- A company may still be eligible for ordinary Directory listing/matching when marketing is blocked; the restriction is on marketing/outreach, not on the existence of the company profile itself.
- Existing Proffera recipient suppression/opt-out rules remain additive. Passing the SCB check never overrides a Proffera opt-out.

## 6. Service interruption and misuse

- SCB may interrupt the service for maintenance or security reasons. Proffera must fail safely rather than bypassing SCB controls.
- If SCB access is unavailable, code must not substitute unverified data as if it were fresh SCB data.
- Any suspected credential leak, prohibited data use or repeated rate-limit violation is a security incident and should stop the affected SCB job until reviewed.

## 7. Required engineering checks

Any PR changing SCB or SCB-backed outreach must verify, where relevant:

1. credentials remain server-only and absent from logs/source;
2. request rate remains within 10 requests / 10 seconds;
3. no single fetch can exceed 2,000 rows;
4. juridical-person/privacy safeguards remain in place;
5. reklamspärr is checked before automated outreach;
6. existing recipient suppressions remain enforced;
7. public/exported SCB-derived data has correct source attribution and own-processing wording when transformed;
8. tests cover fail-closed behavior for blocked and unknown advertising status.

## 8. Database enforcement follow-up

Application-level candidate and send guards should enforce this policy. A database-level dispatch guard is additional defense in depth. Changes to database functions/triggers are migration work and must follow Proffera's explicit migration approval process before implementation or Production application.
