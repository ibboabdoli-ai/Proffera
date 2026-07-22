# AI Chat Commerce Integration Plan

## Purpose

Connect Proffera workspaces and Stripe subscription state to the existing
multi-tenant Service AI Chat product without merging repositories, databases,
or customer data.

## Current boundary

- **Proffera** owns its Better Auth user, workspace, Stripe subscription, plan
  and customer-facing dashboard.
- **Service AI Chat** owns its Supabase tenant, tenant user access, Inbox,
  widget settings, knowledge base, conversations and widget script.
- No service may read the other service's database directly.

## Commercial scope

The first sellable offer is **Professional with AI Chat enabled**. The Stripe
webhook is the source of truth for whether a workspace may provision or use
AI Chat. A separate paid AI add-on can be introduced later without changing
the tenant boundary.

## Integration contract

Proffera calls a private Service AI Chat integration endpoint over HTTPS. Each
request includes:

- a versioned JSON payload;
- an ISO timestamp;
- an HMAC-SHA-256 signature of timestamp and exact request body;
- a unique Proffera workspace ID;
- workspace name, owner email and allowed website origin.

Service AI Chat verifies the signature, rejects stale requests, and performs
idempotent upserts. The response returns the stable `tenantId`, widget
`clientId`, status and supported panel paths. API secrets never reach the
browser.

## States

| Stripe / Proffera state | AI tenant state | Customer experience |
| --- | --- | --- |
| Professional `active` or `trialing` | `active` | AI dashboard links and widget installation are available. |
| `past_due` or `paused` | `suspended` | Existing data is preserved; widget and panel actions are unavailable. |
| `cancelled` | `suspended` | Same as suspended until reactivation or retention expiry. |
| no Professional plan | none / `suspended` | AI is not shown as an active customer feature. |

Cancellation never deletes conversations automatically. Deletion requires a
separate, explicit retention workflow.

## Delivery sequence

### 1. Contract and database mapping

1. Add `workspace_ai_chat_integrations` in Proffera, keyed by workspace ID.
2. Store the remote tenant ID, client ID, lifecycle state, last sync time and
   safe error code only.
3. Add an idempotent remote mapping in Service AI Chat keyed by Proffera
   workspace ID.
4. Add tests for request signing and lifecycle mapping.

**Gate:** neither existing `iboren` nor `proffera` tenant is altered.

### 2. Secure tenant provisioning

1. Add Service AI Chat private provision/suspend endpoint.
2. Create settings, allowed domains and tenant owner invitation through the
   existing tenant bootstrap primitives.
3. Ensure retries return the original tenant rather than creating duplicates.
4. Keep public self-signup as a trial-only path or disable it before a paid
   Proffera launch.

**Gate:** a test workspace can be provisioned twice and resolves to one
tenant, one tenant owner and one widget client ID.

### 3. Stripe-driven synchronisation

1. After Proffera has safely persisted a Stripe subscription snapshot, derive
   AI eligibility from `Professional` plus an active/trialing status.
2. Queue/retry the remote synchronisation without failing Stripe's webhook
   acknowledgement solely because Service AI Chat is temporarily unavailable.
3. Surface a non-secret provisioning status to the workspace owner.

**Gate:** create, update, cancellation and replayed Stripe events produce the
expected remote lifecycle state without duplicate tenants.

### 4. Customer dashboard and access

1. Replace the current fixed `tenant=proffera` preview with workspace-specific
   links driven by the integration mapping.
2. Show Inbox, settings, widget installation and demo only for an eligible
   workspace owner/admin.
3. First release: create/invite a separate Service AI Chat account for the
   workspace owner and use its existing tenant-scoped login.
4. Later release: add one-time signed SSO handoff. Do not pass an arbitrary
   tenant ID as authority.

**Gate:** one customer cannot open another customer's panel by editing a URL.

### 5. Production hardening

1. Correct Service AI Chat's stale `widget-v2.js` installation snippet to the
   current `widget.js` contract.
2. Add atomic usage counting/IP abuse controls and a production RLS review in
   Service AI Chat before broad sales.
3. Add end-to-end test evidence for widget -> conversation -> tenant Inbox.
4. Add a support runbook, retention policy and rollback instructions.

## Rollback

- Disable AI Chat for the affected workspace in Proffera.
- Send a `suspended` state only; do not delete remote customer data.
- Remove the widget script from the customer's site if a widget regression is
  isolated to that installation.
- Preserve the mapping and event record for diagnosis and safe reactivation.
