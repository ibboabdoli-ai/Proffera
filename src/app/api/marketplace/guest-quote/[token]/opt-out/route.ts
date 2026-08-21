import { NextResponse } from "next/server";

import { suppressMarketplaceGuestRecipientWithHistory } from "@/lib/marketplace-guest-opt-out-history";
import { hashMarketplaceGuestToken } from "@/lib/marketplace-guest-quote";
import { allowPublicSubmission } from "@/lib/public-form-protection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ token: string }>;
};

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function redirectToOptOut(request: Request, token: string, status: string, locale: "sv" | "en") {
  const target = new URL(`/offert/svara/${encodeURIComponent(token)}/avregistrera`, request.url);
  target.searchParams.set("status", status);
  if (locale === "en") target.searchParams.set("lang", "en");
  return NextResponse.redirect(target, 303);
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });

  const form = await request.formData();
  const locale = String(form.get("lang") ?? "") === "en" ? "en" as const : "sv" as const;

  const allowed = await allowPublicSubmission({
    scope: "marketplace-guest-opt-out",
    requestHeaders: request.headers,
    identity: hashMarketplaceGuestToken(token),
    maxAttempts: 3,
    windowSeconds: 60 * 60,
  });
  if (!allowed) return redirectToOptOut(request, token, "rate_limited", locale);

  const result = await suppressMarketplaceGuestRecipientWithHistory(token);
  return redirectToOptOut(request, token, result.ok ? "done" : result.code, locale);
}