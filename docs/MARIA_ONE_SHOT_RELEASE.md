# Makeup by Maria — coordinated website + real booking release

**Decision date:** 2026-11-07. **Status:** PREPARATION ONLY; NOT APPROVED FOR LIVE MERGE, DATABASE WRITES, DOMAIN TRANSFER, OR CUSTOMER BOOKINGS.

## Source of truth and release scope

- Use the single Ready-for-review, unmerged pull request [#971](https://github.com/ibboabdoli-ai/Proffera/pull/971), whose review branch consolidates the older Maria Preview candidates (#943 and #960). **Do not merge those older PRs separately.**
- Deliver the Swedish/English/Arabic public site and real, email-verified Maria bookings together, with manager controls at `https://www.proffera.se/dashboard`.
- Owner-approved 2026 Production prices (2026-11-09): bridal makeup **with trial 6,000 SEK** and **without trial 5,000 SEK**. The previous 6,900/5,800 target is superseded; Maria must retain the ability to edit each year's price and SV/EN/AR service descriptions for 2026–2036. Release preflight validates safe positive fixed-price amounts rather than hardcoding a stale target.
- No automatic Swish confirmation or charge. A customer booking starts as `requested`; Maria confirms or rejects it in her authenticated dashboard. Manual calendar closing/reopening is independent of actual bookings.
- The owner's statement that no real customers or bookings exist is useful rollout context, **not** evidence that authentication, email, multi-tenant access, migrations, or rollback can be skipped.

## Verified snapshot (2026-11-07; recheck the exact head before release)

- QA branch checkpoint `2794dad26ebea5b9cd248435a944e5fd3aa8fba0`: required GitHub CI, security regressions, CodeQL, targeted checks, and production-base health succeeded. SonarQube and authenticated Preview browser smoke were **skipped**, not successful.
- Two latest review findings were fixed: direct dotted demo-HTML access and fabricated selectable times when branded booking is closed. Their review threads are resolved; this does not confer blanket approval for a new release SHA.
- Maria's domain and `www` are verified and currently point to the **separate** Vercel project `makeupbymaria-site`, which hosts a READY static holding page. Remember its known-good deployment before any cutover.
- The application, booking API, dashboard, and Git-connected automatic `main` Production deployments run in a **different** Vercel project, `proffera-jhap`. A merge to `main` can cause an automatic Production build; do not use merge as a staging test.
- The connected Neon account does not expose the Proffera Production database. The prior read-only Production snapshot reported unpublished Maria services priced 6,000/5,000 SEK, absent live public booking slug/entitlement, and missing or unverified Maria migration receipts. This snapshot **must not** be treated as a current DB inspection.
- Vercel's Production environment currently lists a Production database and Brevo key by **name**; the Maria Production publication and editor feature switches are **not configured**. No secret values were read.

## Current source reconciliation (2026-11-07, unmerged)

- Gated Production code paths for public booking, real-recipient OTP issuance/resend/verification/finalization, manager status/calendar/manual Swish, canonical host routing and current schema inspection have been implemented and tested in isolated environments. They remain disabled by default. CodeRabbit review findings are being reconciled; source implementation does **not** mean Production activation is approved.
- Do not restart implemented features from their former Preview-only description below. Verify the **actual current code paths** and the required current-head tests, then perform separately authorized read-only Production preflight and synthetic production acceptance before any live release.

## Implementation and deployment checks required before live enablement

1. **Controlled Production booking runtime, default OFF.** Source now includes an explicit, independently default-OFF Production activation contract; verify its runtime handling for Maria availability, OTP issuance/resend/verification/finalization, customer recipients and manager writes. Preview retains the separate approved QA inbox. Keep feature flags disabled unless all checks below pass. Preserve same-origin/host validation, server-side tenant binding, rate limits, one-operator transaction locks, service duration/buffers, OTP hold conflict checks, and verified-booking atomicity.
2. **Manager operation in Production.** The Maria Production dashboard has guarded content editing, and gated manager calendar and booking-status action implementations are now present; validate their actual current-head behavior. Authorize only Maria owner/admin on the selected `makeup-by-maria` workspace, and cover requested -> confirmed/cancelled, manual close/open, staff/customer isolation and failure paths with tests. Avoid displaying a writable control unless its server action is authorized.
3. **One origin/route contract.** Serve the branded public site and its booking/availability APIs from the same `proffera-jhap` deployment under `makeupbymaria.se`; preserve the Proffera login/dashboard at `www.proffera.se/dashboard`. Make customer verification and self-service links point to an approved canonical origin, never a Preview URL or an untrusted Host header. Validate apex and `www` SSL/redirect rules and branded demo-HTML host restrictions.
4. **Customer delivery.** The Production real-recipient delivery code path exists but must be acceptance-tested with authorized synthetic recipients; real Brevo must deliver OTP and booking/status emails without Preview recipient rewriting. Verify branding, locale including Arabic RTL, customer/manager notice routing and error/uncertain-delivery behavior. Test against authorized synthetic recipients before enabling public traffic. Never infer successful Swish payments from booking or email state.
5. **Production data, only after separately authorized execution.** Run `node scripts/maria-production-booking-preflight.mjs --read-only` with an **authorized** connection; never copy isolated Preview customer/tenant records. Verify canonical ledger **and actual schema** for `20261103_0072`, `20261105_0073` and `20261107_0074` before a narrowly scoped additive migration. Confirm Maria owner contact/timezone, booking slug, `online_booking` entitlement, active published services, editable 2026–2036 descriptions, approved prices in SEK, and manager-defined duration, buffers, and weekend availability. The presence of existing 0073 columns is not proof its migration ledger is complete.
6. **Acceptance and review on the exact final SHA.** Require GitHub checks, Security/CodeQL, independent review findings reconciled, Preview authenticated end-to-end flows in SV/EN/AR, mobile, OTP requested -> confirmed, double-booking and owner-only negative tests, email delivery, and rollback rehearsal. Existing green tests on an earlier SHA do not prove a newly changed Production path.

## Controlled one-shot publication sequence

1. Finish the default-off Production booking code and independently review it on Draft PR #971. **Do not set a Production flag or merge yet.**
2. Verify database, owner entitlement, service publishing, prices, email origin and all necessary additive migrations with separate authorization, backups and a recorded rollback procedure.
3. Stage a **Production-built but not publicly aliased** release from the reviewed exact SHA; inspect it using authorized test accounts and synthetic bookings, and verify both booking and dashboard paths without real Swish or customers.
4. Verify that the `proffera-jhap` `main` auto-deploy controls cannot expose incomplete work unexpectedly, then obtain separate explicit owner approval for the merge and public cutover.
5. Move the apex and `www` domain routing from `makeupbymaria-site` to the reviewed `proffera-jhap` deployment as one controlled operation; validate HTTPS, translations, images, internal links, and verified email booking end-to-end. Enable only the reviewed Production feature switches once the origin, data and runtime are ready.
6. Observe application errors, booking conflicts, OTP delivery, dashboard changes and actual availability. Confirm the expected domain deployment SHA; report live status only after the public URL matches it.

## Abort / rollback

- Keep the current standalone holding-page deployment and alias details recorded as a fallback. If any live acceptance check fails, **disable Production booking first**, prevent additional writes, restore the previously verified domain deployment, and recheck the SSL/site/booking state.
- Do not automatically downgrade Production schema or delete existing bookings. Any schema rollback needs a separate data-preservation decision.
- A successful GitHub merge or Vercel `READY` build **alone is not proof** of working public booking.

**Approval boundary:** The 2026-11-07 instruction authorizes **preparation of a combined release**, not an immediate `main` merge, Production migration, real email delivery, domain cutover, or booking activation.
