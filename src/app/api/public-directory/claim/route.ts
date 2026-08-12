import { NextResponse } from "next/server";

import { getServerSession } from "@/lib/auth-session";

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
    return NextResponse.redirect(new URL(`${returnTo}?status=invalid_details`, request.url), 303);
  }

  const session = await getServerSession();
  if (!session?.user?.id) {
    const login = new URL("/logga-in", request.url);
    login.searchParams.set("next", returnTo);
    return NextResponse.redirect(login, 303);
  }

  const method = String(form.get("method") ?? "manual_review").trim();
  if (method === "bankid") {
    return NextResponse.redirect(new URL(`${returnTo}?status=bankid_unavailable`, request.url), 303);
  }

  // Manual claims must go through /claim-email/send and /claim-email/verify.
  // Keeping this legacy route fail-closed prevents a direct POST from bypassing
  // the verified business-email step.
  return NextResponse.redirect(new URL(`${returnTo}?status=email_verification_required`, request.url), 303);
}
