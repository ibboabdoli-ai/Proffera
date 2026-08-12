import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth-session";
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

function validEmail(value: string) {
  return value.length >= 5
    && value.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function claimReference(input: {
  claimantName: string;
  role: string;
  businessEmail: string;
  phone: string;
  accountEmail: string;
}) {
  return [
    "manual",
    `name=${input.claimantName}`,
    `role=${input.role}`,
    `business_email=${input.businessEmail}`,
    `phone=${input.phone || "-"}`,
    `account_email=${input.accountEmail}`,
  ].join(";");
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ ok: false, error: "Invalid origin" }, { status: 403 });
  }

  const form = await request.formData();
  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  const returnTo = safeReturnPath(String(form.get("returnTo") ?? `/foretag/claim/${slug}`));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return NextResponse.redirect(new URL(`${returnTo}?status=invalid`, request.url), 303);
  }

  const session = await getServerSession();
  const userId = session?.user?.id ? String(session.user.id) : "";
  if (!userId) {
    const login = new URL("/logga-in", request.url);
    login.searchParams.set("next", returnTo);
    return NextResponse.redirect(login, 303);
  }

  const method = compactText(form.get("method"), 40) || "manual_review";
  if (method === "bankid") {
    return NextResponse.redirect(new URL(`${returnTo}?status=bankid_unavailable`, request.url), 303);
  }
  if (method !== "manual_review") {
    return NextResponse.redirect(new URL(`${returnTo}?status=invalid_details`, request.url), 303);
  }

  const claimantName = compactText(form.get("claimantName"), 100);
  const role = compactText(form.get("role"), 80);
  const businessEmail = compactText(form.get("businessEmail"), 254).toLowerCase();
  const phone = compactText(form.get("phone"), 40);
  const confirmed = String(form.get("confirmAuthority") ?? "") === "yes";
  if (claimantName.length < 2 || role.length < 2 || !validEmail(businessEmail) || !confirmed) {
    return NextResponse.redirect(new URL(`${returnTo}?status=invalid_details`, request.url), 303);
  }

  const allowed = await allowPublicSubmission({
    scope: "company-directory-claim",
    requestHeaders: request.headers,
    identity: userId,
    maxAttempts: 5,
    windowSeconds: 3600,
  });
  if (!allowed) {
    return NextResponse.redirect(new URL(`${returnTo}?status=rate_limited`, request.url), 303);
  }

  const sql = getSql();
  if (!sql) return NextResponse.redirect(new URL(`${returnTo}?status=unavailable`, request.url), 303);

  const [profiles, accountRows] = await Promise.all([
    sql`
      select id::text, claimed_workspace_id::text
      from company_directory_profiles
      where public_slug = ${slug}
        and publication_status = 'published'
        and privacy_blocked = false
        and auto_public_eligible = true
      limit 1
    `,
    sql`
      select email, "emailVerified"
      from "user"
      where id = ${userId}
      limit 1
    `,
  ]);

  const profile = profiles[0];
  if (!profile?.id) return NextResponse.redirect(new URL(`${returnTo}?status=not_found`, request.url), 303);
  if (profile.claimed_workspace_id) return NextResponse.redirect(new URL(`${returnTo}?status=claimed`, request.url), 303);

  const account = accountRows[0];
  const accountEmail = String(account?.email ?? "").trim().toLowerCase();
  if (!accountEmail || !account?.emailVerified) {
    return NextResponse.redirect(new URL(`${returnTo}?status=account_email_unverified`, request.url), 303);
  }

  const verificationReference = claimReference({ claimantName, role, businessEmail, phone, accountEmail });

  try {
    await sql`
      insert into company_directory_claims (
        profile_id, claimant_user_id, status, verification_method, verification_reference, requested_at
      ) values (
        ${String(profile.id)}::uuid, ${userId}, 'pending', 'manual_review', ${verificationReference}, now()
      )
      on conflict (profile_id, claimant_user_id) where status in ('pending', 'verified')
      do update set
        requested_at = now(),
        verification_method = 'manual_review',
        verification_reference = ${verificationReference}
      where company_directory_claims.status = 'pending'
    `;
  } catch (error) {
    console.error("Failed to create company directory claim", error);
    return NextResponse.redirect(new URL(`${returnTo}?status=unavailable`, request.url), 303);
  }

  return NextResponse.redirect(new URL(`${returnTo}?status=sent`, request.url), 303);
}
