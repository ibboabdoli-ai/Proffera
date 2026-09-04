import { after, NextResponse } from "next/server";

import { hashMarketplaceGuestToken } from "@/lib/marketplace-guest-quote";
import {
  transitionMarketplaceServiceJobByGuestToken,
  type MarketplaceServiceJobStatus,
} from "@/lib/marketplace-service-jobs";
import { deliverMarketplaceServiceJobReviewInvitation } from "@/lib/marketplace-verified-review";
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
  const target = new URL(`/offert/jobb/${encodeURIComponent(token)}`, request.url);
  target.searchParams.set("job", status);
  if (locale === "en") target.searchParams.set("lang", "en");
  return NextResponse.redirect(target, 303);
}

function nextStatus(value: FormDataEntryValue | null): MarketplaceServiceJobStatus | null {
  const status = String(value ?? "");
  return status === "in_progress"
    || status === "completed"
    || status === "provider_cancelled"
    || status === "no_show"
    || status === "problem"
    ? status
    : null;
}

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });

  const form = await request.formData();
  const locale = String(form.get("lang") ?? "") === "en" ? "en" as const : "sv" as const;
  const status = nextStatus(form.get("nextStatus"));
  if (!status) return redirectToJob(request, token, locale, "invalid");

  const allowed = await allowPublicSubmission({
    scope: "marketplace-service-job-provider",
    requestHeaders: request.headers,
    identity: hashMarketplaceGuestToken(token),
    maxAttempts: 10,
    windowSeconds: 30 * 60,
  });
  if (!allowed) return redirectToJob(request, token, locale, "rate_limited");

  const result = await transitionMarketplaceServiceJobByGuestToken({
    token,
    nextStatus: status,
    reason: String(form.get("reason") ?? ""),
    completionSummary: String(form.get("completionSummary") ?? ""),
  });
  if (!result.ok) return redirectToJob(request, token, locale, result.code);

  if (status === "completed") {
    after(async () => {
      const delivery = await deliverMarketplaceServiceJobReviewInvitation(result.job.id);
      if (!delivery.ok) {
        console.error("Marketplace completed job review invitation failed", {
          serviceJobId: result.job.id,
          code: delivery.code,
        });
      }
    });
  }

  return redirectToJob(request, token, locale, status);
}
