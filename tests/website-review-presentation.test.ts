import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  persistWebsiteReviewPresentation,
  websiteReviewPresentationSchema,
  type WebsiteReviewModerationSql,
} from "../src/lib/website-review-moderation";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

function sqlMock() {
  const calls: Array<{ query: string; values: readonly unknown[] }> = [];
  const sql = vi.fn(async (strings: TemplateStringsArray, ...values: readonly unknown[]) => {
    calls.push({ query: strings.join("$value").replace(/\s+/g, " ").trim(), values });
    return [{ id: "review-id" }];
  }) as unknown as WebsiteReviewModerationSql;
  return { sql, calls };
}

describe("website review owner replies and featured display", () => {
  it("normalizes presentation input", () => {
    expect(websiteReviewPresentationSchema.parse({ ownerReply: "  Thank you!  ", isFeatured: true })).toEqual({
      ownerReply: "Thank you!",
      isFeatured: true,
    });
    expect(websiteReviewPresentationSchema.parse({ ownerReply: "   ", isFeatured: false })).toEqual({
      ownerReply: null,
      isFeatured: false,
    });
  });

  it("updates only approved verified reviews and audits presentation changes", async () => {
    const { sql, calls } = sqlMock();
    await persistWebsiteReviewPresentation({
      sql,
      actorUserId: "workspace-owner",
      workspaceId: "3117da1c-1ea6-4d3d-8597-a30b3ec484d3",
      reviewId: "73d7ad7c-84e9-4b97-ba7f-030305747ce6",
      presentation: { ownerReply: "Thank you for the feedback.", isFeatured: true },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.query).toContain("status = 'approved'");
    expect(calls[0]?.query).toContain("is_verified = true");
    expect(calls[0]?.query).toContain("owner_reply");
    expect(calls[0]?.query).toContain("owner_replied_at");
    expect(calls[0]?.query).toContain("is_featured");
    expect(calls[0]?.query).toContain("website_review.presentation_updated");
  });

  it("orders featured reviews first and calculates aggregate rating across all public reviews", () => {
    const database = source("src/lib/website-reviews-db.ts");
    const publicPage = source("src/app/demo/primeview/page.tsx");

    expect(database).toContain("order by review.is_featured desc");
    expect(database).toContain("avg(review.rating)");
    expect(database).toContain("count(*)");
    expect(publicPage).toContain("reviewSummary.averageRating.toFixed(1)");
    expect(publicPage).toContain("review.ownerReply");
    expect(publicPage).toContain("PrimeView reply");
  });
});
