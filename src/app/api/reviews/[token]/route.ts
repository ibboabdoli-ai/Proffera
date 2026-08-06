import { NextResponse } from "next/server";

import {
  verifiedReviewSubmissionSchema,
  verifiedReviewTokenSchema,
} from "@/features/reviews/verified-review";
import { allowPublicSubmission } from "@/lib/public-form-protection";
import { submitVerifiedReview } from "@/lib/verified-review-invitations";
import { hashVerifiedReviewToken } from "@/lib/verified-review-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { token } = await context.params;
  const parsedToken = verifiedReviewTokenSchema.safeParse(token);
  if (!parsedToken.success) {
    return NextResponse.json(
      { error: "This review link is invalid." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Please check the form and try again." }, { status: 400 });
  }

  const parsedReview = verifiedReviewSubmissionSchema.safeParse(payload);
  if (!parsedReview.success) {
    return NextResponse.json(
      { error: "Please complete the review form with valid details." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const review = parsedReview.data;
  if (review.website) {
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const elapsed = Date.now() - review.formStartedAt;
  if (elapsed < 2_500 || elapsed > 24 * 60 * 60 * 1_000) {
    return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 400 });
  }

  const allowed = await allowPublicSubmission({
    scope: "verified_review",
    requestHeaders: request.headers,
    identity: hashVerifiedReviewToken(parsedToken.data),
    maxAttempts: 4,
    windowSeconds: 30 * 60,
  });

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait before trying again." },
      { status: 429, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await submitVerifiedReview(parsedToken.data, review);
  if (!result.ok) {
    const status = result.code === "invalid" ? 404 : result.code === "database" ? 503 : 409;
    const error =
      result.code === "expired"
        ? "This review link has expired."
        : result.code === "used"
          ? "This review link has already been used."
          : result.code === "revoked"
            ? "This review link is no longer active."
            : result.code === "unavailable"
              ? "This booking is not eligible for a review."
              : result.code === "database"
                ? "The review could not be submitted right now."
                : "This review link is invalid.";

    return NextResponse.json(
      { error },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: true },
    { status: 201, headers: { "Cache-Control": "no-store" } },
  );
}
