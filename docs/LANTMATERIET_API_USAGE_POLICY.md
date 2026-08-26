# Lantmäteriet API usage policy

Status: binding project policy for Proffera code that reads, stores, transforms, displays, exports, or otherwise uses Lantmäteriet address/geodata. This document translates the approved product terms into engineering rules; it does not replace Lantmäteriet's legal terms or the purpose approved in the account's juridisk prövning.

## 1. Product and approved purpose

- Proffera's authoritative address-detail/coordinate product is `Lantmäteriet – Belägenhetsadress Direkt` v4.2.
- Address-reference lookup may use an approved Referens Uppslag Adress product as a technical lookup step, but each product remains subject to its own account permission and terms.
- Belägenhetsadress Direkt may contain personal data from the fastighetsregister. Processing must remain within the purpose approved by Lantmäteriet in the applicable juridisk prövning.
- The current Proffera purpose is bounded address verification/geocoding for Company Directory and Marketplace location/matching flows. Do not expand this path into owner/person lookup, profiling, unrelated enrichment, or another purpose without a new legal/contract review and any required Lantmäteriet approval.

## 2. Credentials and transport

- Lantmäteriet credentials are server-side secrets. Usernames, passwords, tokens or other credentials must never be committed, logged, exposed to browser/client code, or pasted into issues/PRs.
- Upstream requests must use HTTPS and only approved Lantmäteriet API hosts/product paths.
- Test and Production endpoints/credentials must not be silently mixed.
- If configuration is invalid or the authoritative verification cannot be completed, the flow must fail safely rather than inventing or treating unverified coordinates as Lantmäteriet-verified data.

## 3. License and attribution

For Belägenhetsadress Direkt data that Proffera publishes, distributes, exports, or otherwise exposes outside internal processing:

- use is permitted under CC BY 4.0, including commercial use, modification and combination, subject to the applicable personal-data/purpose restrictions;
- identify the source as `Lantmäteriet – Belägenhetsadress Direkt` (or an equivalent wording that includes both Lantmäteriet and the product name);
- when Proffera selects, transforms, geocodes, combines or calculates derived values from the source, also state that Proffera has performed its own processing (`egen bearbetning`, or `processed by Proffera` in English);
- do not imply that owner-, Bolagsverket-, SCB- or Proffera-originated fields came from Lantmäteriet.

Attribution must follow actual provenance. When a surface may contain a mix of Lantmäteriet and other location sources, wording such as `when Lantmäteriet data is used` is required instead of falsely attributing every result to Lantmäteriet.

## 4. GDPR and private location data

- Proffera remains responsible for lawful GDPR processing of personal data used through the integration.
- Exact customer address, official object/reference identifiers and precise coordinates collected for a real Marketplace request are private matching data. They must not be projected to an unselected provider, public Directory page, public API, SEO/structured data, sitemap or analytics payload merely because they are available internally.
- Public or provider-visible location must use the existing redacted/entitled projection boundary; the authoritative reference is verification evidence, not a public identifier.
- Data minimization applies: request, store and expose only fields needed for the approved Proffera purpose.
- Material changes to processors, processing geography, data recipients or purpose involving fastighetsregister personal data require legal/contract review before rollout and any Lantmäteriet approval required by the applicable terms.

## 5. Verification and derived distance

- A coordinate may be labelled/treated as verified Lantmäteriet data only when the canonical verification path has accepted the authoritative address result and recorded the expected provenance.
- Browser geolocation and owner-entered coordinates are separate sources and must not be relabelled as Lantmäteriet.
- Distances/ranking calculated from verified coordinates are Proffera-derived values. When surfaced together with Lantmäteriet-derived location data, use source attribution plus own-processing wording.
- Broad geocoding or bulk expansion must stay inside the approved purpose and must not be enabled merely because an API endpoint is technically reachable.

## 6. Required engineering checks

Any PR changing a Lantmäteriet-backed flow must verify, where relevant:

1. credentials remain server-only and absent from source/logs/client payloads;
2. HTTPS, approved host/path and environment separation remain enforced;
3. the use case stays within the approved juridisk-prövning purpose;
4. exact customer address/reference/coordinates remain private unless an explicit entitlement/product rule authorizes disclosure;
5. public/exported Lantmäteriet-derived data carries `Lantmäteriet – Belägenhetsadress Direkt` attribution;
6. transformed/derived output carries own-processing wording;
7. non-Lantmäteriet sources are not mislabeled as Lantmäteriet;
8. tests cover fail-closed verification and privacy boundaries touched by the change.
