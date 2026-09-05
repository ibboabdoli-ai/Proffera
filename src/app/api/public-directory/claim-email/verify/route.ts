import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth-session";
import {
  checkClaimEmailCode,
  parseClaimEmailEvidence,
  serializeClaimEmailEvidence,
  validBusinessEmail,
} from "@/lib/company-directory-claim-email";
import { tryAutoProvisionMarketplaceCompanyClaim } from "@/lib/company-directory-marketplace-claim";
import { getSql } from "@/lib/db/server";
import { allowPublicSubmission } from "@/lib/public-form-protection";

const MAX_STALE_EVIDENCE_REEVALUATIONS = 5;

function safeReturnPath(value: string) {
  return /^\/(?:foretag\/claim|en\/companies\/claim)\/[a-z0-9-]+$/.test(value) ? value : "/";
}

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function failedCodeStatus(reason: "expired" | "locked" | "invalid") {
  return reason === "expired"
    ? "email_code_expired"
    : reason === "locked"
      ? "email_code_locked"
      : "email_code_invalid";
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Invalid origin" }, { status: 403 });
  }

  const form = await request.formData();
  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  const code = String(form.get("code") ?? "").replace(/\D/g, "").slice(0, 6);
  const returnTo = safeReturnPath(String(form.get("returnTo") ?? `/foretag/claim/${slug}`));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.redirect(new URL(`${returnTo}?status=invalid_details`, request.url), 303);
  }

  const session = await getServerSession();
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) {
    const login = new URL("/logga-in", request.url);
    if (returnTo.startsWith("/en/")) login.searchParams.set("lang", "en");
    login.searchParams.set("next", returnTo);
    return NextResponse.redirect(login, 303);
  }

  const allowed = await allowPublicSubmission({
    scope: "company-directory-claim-email-verify",
    requestHeaders: request.headers,
    identity: `${userId}:${slug}`,
    maxAttempts: 10,
    windowSeconds: 15 * 60,
  });
  if (!allowed) {
    return NextResponse.redirect(new URL(`${returnTo}?status=rate_limited`, request.url), 303);
  }

  const sql = getSql();
  if (!sql) return NextResponse.redirect(new URL(`${returnTo}?status=unavailable`, request.url), 303);

  const rows = await sql`
    select
      claim.id::text,
      claim.status,
      claim.verification_method,
      claim.verification_reference,
      profile.claimed_workspace_id::text,
      profile.claim_reservation_id::text,
      u.email as account_email
    from company_directory_claims claim
    join company_directory_profiles profile on profile.id = claim.profile_id
    join "user" u on u.id = claim.claimant_user_id
    where profile.public_slug = ${slug}
      and claim.claimant_user_id = ${userId}
      and claim.status = 'pending'
      and claim.verification_method = 'email_domain'
    order by claim.requested_at desc
    limit 1
  `;
  let row = rows[0];
  if (!row?.id) return NextResponse.redirect(new URL(`${returnTo}?status=invalid_details`, request.url), 303);
  const claimId = String(row.id);

  for (let staleReevaluation = 0; staleReevaluation <= MAX_STALE_EVIDENCE_REEVALUATIONS; staleReevaluation += 1) {
    if (row.claimed_workspace_id) return NextResponse.redirect(new URL(`${returnTo}?status=claimed`, request.url), 303);
    if (row.claim_reservation_id) return NextResponse.redirect(new URL(`${returnTo}?status=unavailable`, request.url), 303);

    const accountEmail = String(row.account_email ?? "").trim().toLowerCase();
    if (!validBusinessEmail(accountEmail)) {
      return NextResponse.redirect(new URL(`${returnTo}?status=account_email_unverified`, request.url), 303);
    }

    const originalVerificationReference = String(row.verification_reference ?? "");
    const evidence = parseClaimEmailEvidence(originalVerificationReference);
    if (!evidence || evidence.accountEmail !== accountEmail) {
      return NextResponse.redirect(new URL(`${returnTo}?status=invalid_details`, request.url), 303);
    }

    if (evidence.stage === "business_email_verified") {
      return NextResponse.redirect(new URL(`${returnTo}?status=sent`, request.url), 303);
    }
    if (evidence.stage === "business_email_locked") {
      return NextResponse.redirect(new URL(`${returnTo}?status=email_code_locked`, request.url), 303);
    }

    const checked = checkClaimEmailCode(evidence, code);
    if (!checked.ok && checked.reason === "expired") {
      return NextResponse.redirect(new URL(`${returnTo}?status=email_code_expired`, request.url), 303);
    }
    const verificationReference = serializeClaimEmailEvidence(checked.evidence);

    if (!checked.ok) {
      const updated = await sql`
        update company_directory_claims
        set verification_reference = ${verificationReference}
        where id = ${claimId}::uuid
          and claimant_user_id = ${userId}
          and status = 'pending'
          and verification_method = 'email_domain'
          and verification_reference = ${originalVerificationReference}
        returning id::text
      `;
      if (updated[0]?.id) {
        return NextResponse.redirect(new URL(`${returnTo}?status=${failedCodeStatus(checked.reason)}`, request.url), 303);
      }
    } else {
      const verified = await sql`
        update company_directory_claims
        set verification_reference = ${verificationReference},
            verification_method = 'email_domain',
            requested_at = now()
        where id = ${claimId}::uuid
          and claimant_user_id = ${userId}
          and status = 'pending'
          and verification_method = 'email_domain'
          and verification_reference = ${originalVerificationReference}
        returning id::text
      `;
      if (verified[0]?.id) {
        try {
          const marketplaceClaim = await tryAutoProvisionMarketplaceCompanyClaim({
            claimId,
            claimantUserId: userId,
          });
          if (marketplaceClaim.status === "provisioned") {
            const target = new URL("/dashboard/marknadsplats", request.url);
            target.searchParams.set("status", "linked");
            if (returnTo.startsWith("/en/")) target.searchParams.set("lang", "en");
            return NextResponse.redirect(target, 303);
          }
        } catch (error) {
          console.error("Marketplace company claim auto-provisioning failed", {
            claimId,
            error,
          });
        }

        return NextResponse.redirect(new URL(`${returnTo}?status=sent`, request.url), 303);
      }
    }

    if (staleReevaluation === MAX_STALE_EVIDENCE_REEVALUATIONS) {
      return NextResponse.redirect(new URL(`${returnTo}?status=unavailable`, request.url), 303);
    }

    const refreshedRows = await sql`
      select
        claim.id::text,
        claim.status,
        claim.verification_method,
        claim.verification_reference,
        profile.claimed_workspace_id::text,
        profile.claim_reservation_id::text,
        u.email as account_email
      from company_directory_claims claim
      join company_directory_profiles profile on profile.id = claim.profile_id
      join "user" u on u.id = claim.claimant_user_id
      where claim.id = ${claimId}::uuid
        and profile.public_slug = ${slug}
        and claim.claimant_user_id = ${userId}
        and claim.status = 'pending'
        and claim.verification_method = 'email_domain'
      limit 1
    `;
    row = refreshedRows[0];
    if (!row?.id) {
      return NextResponse.redirect(new URL(`${returnTo}?status=unavailable`, request.url), 303);
    }
  }

  return NextResponse.redirect(new URL(`${returnTo}?status=unavailable`, request.url), 303);
}
