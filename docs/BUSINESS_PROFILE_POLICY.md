# BusinessProfilePolicy

`BusinessProfilePolicy` is the central read/presentation contract for one Proffera business identity. It does **not** replace the existing source tables with one mega-table.

The stable business identity remains `company_directory_profiles.id`. The policy resolves three authority layers:

1. **Official** — legal identity and official classification/location facts.
2. **Owner** — verified claimed-Workspace presentation, exact owner-managed services and eligible owner media.
3. **Proffera** — verified reputation, confirmed service-area evidence and other platform-controlled trust signals.

## Precedence invariants

- Official legal name/form/status/SNI remain official truth.
- A verified claimed Workspace may override presentation name and description without overwriting legal truth.
- Workspace service `public_slug` is a URL/SEO identity; `primary_directory_service_slug` is the canonical Directory/Marketplace taxonomy identity.
- Unconfirmed Directory/SNI service suggestions are not projected as exact offered services by the policy.
- Owner service truth, eligible media, reputation and business identity survive Paid/entitled → Free downgrade; entitlements only disable capabilities.
- Owner and entitlement data are accepted only when their Workspace id matches `company_directory_profiles.claimed_workspace_id`.
- Direct contact remains entitlement-gated. Search and Marketplace provider projections do not carry direct contact fields.
- SEO projection applies the same direct-contact gate and cannot bypass it.

## Media precedence

For the current single-profile projection:

```text
owner hero
→ owner featured image
→ real Directory business media
→ owner logo
→ Directory/category illustration
```

## Projection boundaries

The policy exposes context-specific allowlists:

- `PublicProfile` — legal facts, owner/official presentation, public-safe location/contact, services, public reputation summary and capability flags.
- `SearchCard` — public-safe identity/locality/media/services/reputation summary and capability flags; no direct contact or street-address field.
- `MarketplaceProvider` — matching-safe identity, canonical services, confirmed service areas, operational reputation signals and capability flags; no customer-location data.
- `SEO` — only independently public-safe presentation/location/reputation/contact fields, with contact subject to the same entitlement gate.

The single-profile resolver starts from the public-safe Directory identity and resolves the linked Workspace from the profile itself. It never accepts a caller-supplied Workspace id.

Bulk Search hydration remains a separate phase so the Search path can stay bounded and avoid N+1 owner/entitlement reads.
