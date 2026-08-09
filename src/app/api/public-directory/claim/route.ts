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

  const profiles = await sql`
    select id::text, claimed_workspace_id::text
    from company_directory_profiles
    where public_slug = ${slug}
      and publication_status in ('published', 'ready')
      and privacy_blocked = false
    limit 1
  `;
  const profile = profiles[0];
  if (!profile?.id) return NextResponse.redirect(new URL(`${returnTo}?status=not_found`, request.url), 303);
  if (profile.claimed_workspace_id) return NextResponse.redirect(new URL(`${returnTo}?status=claimed`, request.url), 303);

  try {
    await sql`
      insert into company_directory_claims (
        profile_id, claimant_user_id, status, verification_method, requested_at
      ) values (
        ${String(profile.id)}::uuid, ${userId}, 'pending', 'manual_review', now()
      )
      on conflict (profile_id, claimant_user_id) where status in ('pending', 'verified')
      do update set requested_at = now()
    `;
  } catch (error) {
    console.error("Failed to create company directory claim", error);
    return NextResponse.redirect(new URL(`${returnTo}?status=unavailable`, request.url), 303);
  }

  return NextResponse.redirect(new URL(`${returnTo}?status=sent`, request.url), 303);
}
