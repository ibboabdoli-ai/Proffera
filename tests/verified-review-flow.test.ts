import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  persistReviewInvitation,
  persistVerifiedReviewSubmission,
  type VerifiedReviewSql,
} from "../src/lib/verified-review-persistence";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function sqlMock() {
  const calls: Array<{ query: string; values: readonly unknown[] }> = [];
  const sql = vi.fn(
    async (strings: TemplateStringsArray, ...values: readonly unknown[]) => {
      calls.push({
        query: strings.join("$value").replace(/\s+/g, " ").trim(),
        values,
      });
      return [{ submitted: true, review_id: "review-id" }];
    },
  ) as unknown as VerifiedReviewSql;

  return { sql, calls };
}

describe("central verified review flow", () => {
  it("issues and audits a hash-only invitation for an eligible completed booking", async () => {
    const { sql, calls } = sqlMock();

    await persistReviewInvitation({
      sql,
      actorUserId: "workspace-manager",
      workspaceId: "3117da1c-1ea6-4d3d-8597-a30b3ec484d3",
      bookingId: "73d7ad7c-84e9-4b97-ba7f-030305747ce6",
      tokenHash: "a".repeat(64),
      expiresAt: "2026-09-05T07:00:00.000Z",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.query).toContain("b.status = 'completed'");
    expect(calls[0]?.query).toContain("feature.feature_key = 'verified_reviews'");
    expect(calls[0]?.query).toContain("token_hash");
    expect(calls[0]?.query).toContain("on conflict (workspace_id, booking_id)");
    expect(calls[0]?.query).toContain("website_review_invitations.status <> 'used'");
    expect(calls[0]?.query).toContain("'website_review.invitation_issued'");
    expect(calls[0]?.query).not.toContain("raw_token");
    expect(calls[0]?.values).toContain("a".repeat(64));
  });

  it("locks, creates the verified review and consumes the invitation atomically", async () => {
    const { sql, calls } = sqlMock();

    await persistVerifiedReviewSubmission({
      sql,
      tokenHash: "b".repeat(64),
      review: {
        reviewerName: "Alex Morgan",
        rating: 5,
        message: "The service was completed carefully and on time.",
        consent: true,
        website: "",
        formStartedAt: Date.now(),
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.query).toContain("for update of invitation");
    expect(calls[0]?.query).not.toContain("w.slug =");
    expect(calls[0]?.query).toContain("invitation_status = 'pending'");
    expect(calls[0]?.query).toContain("expires_at > now()");
    expect(calls[0]?.query).toContain("workspace_status in ('active', 'trial')");
    expect(calls[0]?.query).toContain("feature_enabled = true");
    expect(calls[0]?.query).toContain("booking_status = 'completed'");
    expect(calls[0]?.query).toContain("insert into website_reviews");
    expect(calls[0]?.query).toContain("is_verified");
    expect(calls[0]?.query).toContain("update website_review_invitations");
    expect(calls[0]?.query).toContain("status = 'used'");
  });

  it("uses token-derived tenant isolation and workspace branding", () => {
    const service = source("src/lib/verified-review-invitations.ts");
    const invitationRoute = source("src/app/api/dashboard/review-invitations/route.ts");
    const reviewsPage = source("src/app/dashboard/omdomen/page.tsx");

    expect(service).not.toContain("primeViewWorkspaceSlug");
    expect(service).not.toContain('"primeview-window-care"');
    expect(service).toContain("where invitation.token_hash =");
    expect(service).toContain("workspace_experience_settings");
    expect(service).toContain("workspace_settings");
    expect(invitationRoute).toContain("new URL(");
    expect(invitationRoute).not.toContain("primeViewSite");
    expect(reviewsPage).not.toContain("primeViewWorkspaceSlug");
  });

  it("closes anonymous submissions and publishes only approved verified reviews", () => {
    const route = source("src/app/api/primeview/reviews/route.ts");
    const publicForm = source("src/app/demo/primeview/review-form.tsx");
    const database = source("src/lib/website-reviews-db.ts");

    expect(route).toContain("status: 410");
    expect(route).not.toContain("submitWebsiteReview");
    expect(publicForm).toContain("Verified customers only");
    expect(publicForm).not.toContain("<form");
    expect(database).toContain("review.status = 'approved'");
    expect(database).toContain("review.is_verified = true");
  });
});
