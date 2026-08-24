---
applyTo: "src/lib/auth/**,src/lib/workspace/**,src/app/api/**,middleware.*,tests/**/*auth*.ts,tests/**/*tenant*.ts,tests/**/*workspace*.ts,tests/**/*security*.ts"
---

# Security, privacy and tenant-boundary worker instructions

Use these rules together with `AGENTS.md` and `WORKER_BOOTSTRAP.md` for auth, RBAC, workspace, public API, entitlement, privacy and tenant-isolation work.

## Identity and tenant boundaries

- Resolve Workspace/tenant identity server-side from the authenticated boundary whenever possible. Do not trust a client-supplied Workspace id for authorization.
- A row owned by a previous/stale Workspace claim must not become editable merely because the user can name its id.
- Preserve owner/admin/member role distinctions and existing management permissions.
- Cross-tenant reads/writes fail closed; do not fall back to a global/default Workspace when identity resolution fails.

## Entitlements and public exposure

- UI visibility is not an authorization boundary. Enforce capability/entitlement rules in the server path that returns or mutates the data.
- Paid/plan state changes capabilities, not official business truth or historical customer/job/review data.
- Public contact data, exact address, media and actions must use the canonical BusinessProfile/Directory entitlement and privacy projections rather than ad-hoc field checks.
- Search cards, SEO/structured data and sitemaps must not bypass a privacy/contact gate that the rendered profile enforces.

## Customer/private location

- Exact customer request address/GPS is private operational data.
- Do not place exact customer location in URLs, logs, analytics payloads, public profile/Search/SEO projections or provider responses before the documented unlock boundary.
- Lantmäteriet verification results used for a customer request do not automatically become public company location data.

## API and mutation safety

- Validate authorization before revealing whether another tenant's resource exists when practical.
- Make state-changing requests idempotent or duplicate-safe where retries are plausible.
- Webhook/payment/auth callback verification must fail closed when signature/state/nonce/issuer evidence is missing or invalid.
- Never expose secrets, access tokens, raw webhook secrets, database credentials or private upstream payloads in errors/logs.

## Tests

Add reachable negative coverage as applicable:

- unauthenticated access;
- wrong Workspace/tenant;
- stale claim/ownership;
- insufficient role;
- Free versus Paid entitlement downgrade;
- public/SEO/Search leak paths;
- duplicate/replayed mutation;
- invalid/expired token or signature;
- exact customer-location disclosure before unlock.

Prefer testing the real server boundary rather than only asserting hidden UI controls.
