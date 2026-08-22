import { NextResponse } from "next/server";

import { hashMarketplaceCustomerComparisonToken } from "@/lib/marketplace-customer-comparison";
import { cancelMarketplaceServiceJobByCustomerToken } from "@/lib/marketplace-service-jobs";
import { allowPublicSubmission } from "@/lib/public-form-protection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ token: string }> };

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function redirectToJob(request: Request, token: string, locale: "sv" | "en", status: string) {
  const target = new URL(`/offert/jobb/kund/${encodeURIComponent(token)}`, request.url);
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
    scope: "marketplace-service-job-customer",
    requestHeaders: request.headers,
    identity: hashMarketplaceCustomerComparisonToken(token),
    maxAttempts: 5,
    windowSeconds: 30 * 60,
  });
  if (!allowed) return redirectToJob(request, token, locale, "rate_limited");

  const result = await cancelMarketplaceServiceJobByCustomerToken(
    token,
    String(form.get("reason") ?? ""),
  );
  if (!result.ok) return redirectToJob(request, token, locale, result.code);
  return redirectToJob(request, token, locale, "customer_cancelled");
}
