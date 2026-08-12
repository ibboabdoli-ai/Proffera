import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth-session";
import {
  checkClaimEmailCode,
  parseClaimEmailEvidence,
  serializeClaimEmailEvidence,
  validBusinessEmail,
} from "@/lib/company-directory-claim-email";
import { getSql } from "@/lib/db/server";
import { allowPublicSubmission } from "@/lib/public-form-protection";

function safeReturnPath(value: string) {
  return /^\/foretag\/claim\/[a-z0-9-]+$/.test(value) ? value : "/";
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
  const row = rows[0];
  if (!row?.id) return NextResponse.redirect(new URL(`${returnTo}?status=invalid_details`, request.url), 303);
  if (row.claimed_workspace_id) return NextResponse.redirect(new URL(`${returnTo}?status=claimed`, request.url), 303);
  if (row.claim_reservation_id) return NextResponse.redirect(new URL(`${returnTo}?status=unavailable`, request.url), 303);

  const accountEmail = String(row.account_email ?? "").trim().toLowerCase();
  if (!validBusinessEmail(accountEmail)) {
    return NextResponse.redirect(new URL(`${returnTo}?status=account_email_unverified`, request.url), 303);
  }

  const evidence = parseClaimEmailEvidence(row.verification_reference);
  if (!evidence || evidence.accountEmail !== accountEmail) {
    return NextResponse.redirect(new URL(`${returnTo}?status=invalid_details`, request.url), 303);
  }

  if (evidence.stage === "business_email_verified") {
    return NextResponse.redirect(new URL(`${returnTo}?status=sent`, request.url), 303);
  }

  const checked = checkClaimEmailCode(evidence, code);
  const verificationReference = serializeClaimEmailEvidence(checked.evidence);

  if (!checked.ok) {
    await sql`
      update company_directory_claims
      set verification_reference = ${verificationReference}
      where id = ${String(row.id)}::uuid
        and claimant_user_id = ${userId}
        and status = 'pending'
        and verification_method = 'email_domain'
    `;
    const status = checked.reason === "expired"
      ? "email_code_expired"
      : checked.reason === "locked"
        ? "email_code_locked"
        : "email_code_invalid";
    return NextResponse.redirect(new URL(`${returnTo}?status=${status}`, request.url), 303);
  }

  await sql`
    update company_directory_claims
    set verification_reference = ${verificationReference},
        verification_method = 'email_domain',
        requested_at = now()
    where id = ${String(row.id)}::uuid
      and claimant_user_id = ${userId}
      and status = 'pending'
      and verification_method = 'email_domain'
  `;

  return NextResponse.redirect(new URL(`${returnTo}?status=sent`, request.url), 303);
}
