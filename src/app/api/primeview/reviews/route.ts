import { NextResponse } from "next/server";

import { primeViewReviewSchema, primeViewWorkspaceSlug } from "@/features/primeview/review";
import { allowPublicSubmission } from "@/lib/public-form-protection";
import { submitWebsiteReview } from "@/lib/website-reviews-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const genericSubmissionError = "We couldn't submit your review right now. Please try again shortly.";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  }

  const parsed = primeViewReviewSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Please complete the review form with valid details." }, { status: 400 });
  }

  const review = parsed.data;

  if (review.website) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const elapsed = Date.now() - review.formStartedAt;
  if (elapsed < 2_500 || elapsed > 24 * 60 * 60 * 1_000) {
    return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 400 });
  }

  const allowed = await allowPublicSubmission({
    scope: "primeview_review",
    requestHeaders: request.headers,
    identity: `${review.reviewerName}:${review.message.slice(0, 80)}`,
    maxAttempts: 3,
    windowSeconds: 15 * 60,
  });

  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts. Please wait a little while and try again." }, { status: 429 });
  }

  const saved = await submitWebsiteReview({
    workspaceSlug: primeViewWorkspaceSlug,
    reviewerName: review.reviewerName,
    rating: review.rating,
    service: review.service,
    area: review.area,
    message: review.message,
  });

  if (!saved) {
    return NextResponse.json({ error: genericSubmissionError }, { status: 503 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
