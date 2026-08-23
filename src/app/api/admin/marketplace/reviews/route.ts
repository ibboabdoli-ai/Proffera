import { NextResponse } from "next/server";

import { getAdminForArea } from "@/lib/admin-authorization";
import { moderateMarketplaceVerifiedReview } from "@/lib/marketplace-review-moderation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") === "same-origin";
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function redirectToReviews(request: Request, status: string) {
  const target = new URL("/admin/marketplace/reviews", request.url);
  target.searchParams.set("status", status);
  return NextResponse.redirect(target, 303);
}

export async function POST(request: Request) {
  const admin = await getAdminForArea("quote_admin");
  if (!admin) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Invalid origin" }, { status: 403 });

  const form = await request.formData();
  const reviewId = String(form.get("reviewId") ?? "").trim();
  const decisionRaw = String(form.get("decision") ?? "");
  const decision = decisionRaw === "approved" || decisionRaw === "rejected" ? decisionRaw : null;
  if (!reviewId || !decision) return redirectToReviews(request, "invalid");

  const result = await moderateMarketplaceVerifiedReview({
    reviewId,
    decision,
    adminUserId: admin.userId,
    reason: String(form.get("reason") ?? ""),
  });
  return redirectToReviews(request, result.ok ? decision : result.code);
}
