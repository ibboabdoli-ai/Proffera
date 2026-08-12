import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth-session";
import {
  createClaimEmailChallenge,
  parseClaimEmailEvidence,
  sendClaimBusinessEmailCode,
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

function compactText(value: FormDataEntryValue | null, max: number) {
  return String(value ?? "")
    .replace(/[;|\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Invalid origin" }, { status: 403 });
  }

  const form = await request.formData();
  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
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

  const sql = getSql();
  if (!sql) return NextResponse.redirect(new URL(`${returnTo}?status=unavailable`, request.url), 303);

  const [profiles, accountRows] = await Promise.all([
    sql`
      select id::text, display_name, claimed_workspace_id::text, claim_reservation_id::text
      from company_directory_profiles
      where public_slug = ${slug}
        and publication_status = 'published'
        and privacy_blocked = false
        and auto_public_eligible = true
      limit 1
    `,
    sql`
      select email
      from "user"
      where id = ${userId}
      limit 1
    `,
  ]);

  const profile = profiles[0];
  if (!profile?.id) return NextResponse.redirect(new URL(`${returnTo}?status=not_found`, request.url), 303);
  if (profile.claimed_workspace_id) return NextResponse.redirect(new URL(`${returnTo}?status=claimed`, request.url), 303);
  if (profile.claim_reservation_id) return NextResponse.redirect(new URL(`${returnTo}?status=unavailable`, request.url), 303);

  const account = accountRows[0];
  const accountEmail = String(account?.email ?? "").trim().toLowerCase();
  if (!validBusinessEmail(accountEmail)) {
    return NextResponse.redirect(new URL(`${returnTo}?status=account_email_unverified`, request.url), 303);
  }

  const action = compactText(form.get("action"), 20) || "start";
  const existingRows = await sql`
    select id::text, status, verification_method, verification_reference
    from company_directory_claims
    where profile_id = ${String(profile.id)}::uuid
      and claimant_user_id = ${userId}
      and status in ('pending', 'verified')
    order by requested_at desc
    limit 1
  `;
  const existing = existingRows[0];
  const existingEvidence = parseClaimEmailEvidence(existing?.verification_reference);

  // Once the business email has been verified, freeze the claimant evidence.
  // This prevents a claimant from changing or cancelling the evidence while an
  // administrator is reviewing the same pending claim.
  if (existingEvidence?.stage === "business_email_verified") {
    return NextResponse.redirect(new URL(`${returnTo}?status=sent`, request.url), 303);
  }

  if (action === "reset") {
    if (existing?.id && existing.status === "pending") {
      await sql`
        update company_directory_claims
        set status = 'cancelled', resolved_at = now()
        where id = ${String(existing.id)}::uuid
          and claimant_user_id = ${userId}
          and status = 'pending'
      `;
    }
    return NextResponse.redirect(new URL(`${returnTo}?status=reset`, request.url), 303);
  }

  let claimantName = compactText(form.get("claimantName"), 100);
  let role = compactText(form.get("role"), 80);
  let businessEmail = compactText(form.get("businessEmail"), 254).toLowerCase();
  let phone = compactText(form.get("phone"), 40);
  let confirmed = String(form.get("confirmAuthority") ?? "") === "yes";

  if (action === "resend") {
    if (!existingEvidence || existing?.status !== "pending") {
      return NextResponse.redirect(new URL(`${returnTo}?status=invalid_details`, request.url), 303);
    }
    claimantName = existingEvidence.claimantName;
    role = existingEvidence.role;
    businessEmail = existingEvidence.businessEmail;
    phone = existingEvidence.phone;
    confirmed = true;
    if (existingEvidence.accountEmail !== accountEmail) {
      return NextResponse.redirect(new URL(`${returnTo}?status=account_email_unverified`, request.url), 303);
    }
  }

  if (
    claimantName.length < 2
    || role.length < 2
    || !validBusinessEmail(businessEmail)
    || !confirmed
  ) {
    return NextResponse.redirect(new URL(`${returnTo}?status=invalid_details`, request.url), 303);
  }

  const allowed = await allowPublicSubmission({
    scope: "company-directory-claim-email-send",
    requestHeaders: request.headers,
    identity: `${userId}:${businessEmail}`,
    maxAttempts: 3,
    windowSeconds: 15 * 60,
  });
  if (!allowed) {
    return NextResponse.redirect(new URL(`${returnTo}?status=email_send_rate_limited`, request.url), 303);
  }

  const challenge = createClaimEmailChallenge({
    claimantName,
    role,
    businessEmail,
    phone,
    accountEmail,
  });

  const sent = await sendClaimBusinessEmailCode({
    businessEmail,
    claimantName,
    companyName: String(profile.display_name),
    code: challenge.code,
  });
  if (!sent.ok) {
    console.error("Failed to send company claim business email code", sent.code);
    return NextResponse.redirect(new URL(`${returnTo}?status=email_delivery_failed`, request.url), 303);
  }

  challenge.evidence.providerId = sent.providerId;
  const verificationReference = serializeClaimEmailEvidence(challenge.evidence);

  try {
    const rows = await sql`
      insert into company_directory_claims (
        profile_id, claimant_user_id, status, verification_method, verification_reference, requested_at
      ) values (
        ${String(profile.id)}::uuid, ${userId}, 'pending', 'email_domain', ${verificationReference}, now()
      )
      on conflict (profile_id, claimant_user_id) where status in ('pending', 'verified')
      do update set
        requested_at = now(),
        verification_method = 'email_domain',
        verification_reference = ${verificationReference},
        verified_at = null,
        resolved_at = null
      where company_directory_claims.status = 'pending'
        and not (
          company_directory_claims.verification_method = 'email_domain'
          and company_directory_claims.verification_reference like '%"stage":"business_email_verified"%'
        )
      returning id::text
    `;
    if (!rows[0]?.id) {
      return NextResponse.redirect(new URL(`${returnTo}?status=sent`, request.url), 303);
    }
  } catch (error) {
    console.error("Failed to persist company claim business email challenge", error);
    return NextResponse.redirect(new URL(`${returnTo}?status=unavailable`, request.url), 303);
  }

  return NextResponse.redirect(new URL(`${returnTo}?status=email_code_sent`, request.url), 303);
}
