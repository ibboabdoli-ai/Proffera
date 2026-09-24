# Proffera V1 Marketplace Production Pilot Runbook

This runbook prepares the evidence collection path for the controlled Proffera V1 Marketplace Production pilot. It is **preparation only**. It does not authorize any restricted Production action.

The stable completion requirements remain in `docs/V1_LAUNCH_EVIDENCE_CONTRACT.json`. GitHub issue #548 remains the live execution/evidence board.

## 1. Safety boundary

Before any state-changing Production pilot step:

- obtain fresh explicit owner approval for the exact real-world action being performed;
- treat provider activation, provider/customer outreach, Production Marketplace pilot execution, Production geocoding, Production DB/data writes, migrations, payment/provider configuration, and Vercel/Neon/QStash/scheduler/config/secret mutation as separately restricted;
- never fabricate Quote Requests, Offers, ServiceJobs, reviews, provider eligibility, claim state, Workspace links, or Production evidence with direct SQL, forged sessions, synthetic rows, or admin shortcuts;
- never publish customer/provider PII, exact addresses, private coordinates, tokens, credentials, signing secrets, internal identifiers that reveal personal identity, or private request payloads in GitHub evidence;
- stop immediately if the deployed Production SHA is not the intended current `main`, required health evidence is not green, or a launch-critical P1 is open.

Read-only Production verification may be performed without state mutation.

## 2. Execution preflight

Capture a fresh checkpoint immediately before pilot execution:

1. Current `main` SHA.
2. Exact Vercel Production deployment tied to that SHA and deployment state.
3. Fresh Production runtime-error check.
4. Open PR inventory and changed-file/graph overlap for any active V1 lane.
5. Required exact-head CI / CodeQL / E2E / security / PostgreSQL / Production-base-health evidence for the release-impacting head.
6. Current-head CodeRabbit/Codex evidence and unresolved review-thread count.
7. Current P1 issue inventory.
8. Current Directory/provider authority status needed by the candidate flow.

Do not reuse a historical checkpoint when any relevant head or deployment has moved.

## 3. Candidate rules

Use a genuine controlled provider/customer path only.

For the provider candidate:

- prefer an owner-controlled or otherwise explicitly authorized real company already intended for controlled validation;
- require canonical official identity/ownership evidence;
- require the real claim/Workspace-link path;
- require current service and service-area authority from the existing verified flow;
- fail closed if location/workplace/service-base authority is stale, ambiguous, conflicting, missing, or outside the approved pilot policy;
- if provider activation is not already complete, stop and obtain the separate fresh approval before activating anything.

For the customer side:

- use a genuine application request through the public product flow;
- use non-sensitive test wording and the minimum real-world data required by the application;
- do not use a real uninvolved customer or send external outreach without explicit approval.

## 4. Genuine lifecycle to prove

The controlled pilot must exercise the application itself in this order:

1. **Discover / Search** — customer finds a relevant service/provider path.
2. **Request** — customer submits a valid Quote Request and invalid input still fails clearly.
3. **Matching / Invitation** — the normal matching policy selects an eligible provider and the normal invitation path is used.
4. **Provider view** — the provider opens the genuine invitation/Marketplace view.
5. **Offer** — the provider submits a real Offer through the application.
6. **Compare / Select** — the customer sees persisted offer state and selects the intended Offer.
7. **ServiceJob** — selection creates or links exactly the correct ServiceJob.
8. **Complete** — the genuine completion transition is performed.
9. **Verified Review** — only the eligible verified-review flow becomes available and is completed without bypassing token/eligibility rules.

Do not skip an application boundary by writing directly to the database.

## 5. Evidence map

Map evidence to the V1 contract criteria below. A successful source merge or Preview test is not Production proof.

### Customer / Marketplace

- `customer.discovery_request`
- `customer.matching_invitation_offer`
- `customer.offer_compare_selection`
- `customer.selection_service_job`
- `customer.completed_verified_review`
- `customer.marketplace_tenant_isolation`

### Provider

- `provider.onboarding_claim_workspace`
- `provider.services_service_areas`
- `provider.receive_respond`
- `provider.sole_trader_privacy` when the candidate uses the sole-trader path

### Release quality

Reconfirm the applicable platform criteria at the same Production checkpoint, especially:

- `platform.login_session`
- `platform.i18n_parity`
- `platform.mobile_pwa`
- `platform.directory_scheduler_neon`
- `platform.release_exact_sha_gates`

Billing and PostHog keep their own contract evidence requirements and must not be marked complete merely because the Marketplace pilot succeeds.

## 6. Evidence capture format

For each lifecycle boundary record only the minimum safe evidence:

- timestamp;
- exact Production `main` SHA and Vercel deployment ID;
- criterion ID;
- route or application boundary exercised;
- redacted/non-sensitive object reference when needed for correlation;
- expected state;
- observed state;
- tenant/workspace isolation assertion;
- relevant runtime/log correlation ID only when it contains no secret or PII;
- pass/fail and any rollback/stop action.

Store secrets and private customer/provider data nowhere in GitHub evidence. Redact or hash references when a raw identifier is not necessary.

## 7. Abort conditions

Stop the pilot and do not continue to the next state if any of these occurs:

- wrong Production SHA/deployment;
- new launch-critical P1;
- 5xx/runtime error on the pilot boundary;
- cross-Workspace/tenant data exposure;
- stale or invalid provider/location authority;
- invitation or outreach would reach a party not explicitly approved for the pilot;
- exact address, coordinates, private identifier, token, or secret leaks into public output/log/evidence;
- duplicated Offer, ServiceJob, completion, or review side effect;
- application state differs from the persisted canonical state;
- completing the next step would require a restricted action not covered by fresh explicit approval.

Record the failure as evidence; do not repair Production state with direct DB writes.

## 8. Completion rule

The pilot is complete only when:

- the genuine lifecycle reaches the verified-review end state without bypasses;
- required tenant-isolation assertions hold;
- runtime health remains acceptable on the exact deployed SHA;
- every affected V1 criterion has the required evidence kind recorded;
- any criterion requiring `human_approval` has that explicit approval;
- issue #548 is reconciled against the fresh final state.

If any required evidence kind remains absent, classify the criterion as `UNVERIFIED`, not `DONE` and not automatically `MISSING`.
