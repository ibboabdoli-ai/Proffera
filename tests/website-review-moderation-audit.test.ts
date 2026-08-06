import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  isWebsiteReviewStatus,
  persistWebsiteReviewModeration,
  WEBSITE_REVIEW_STATUSES,
  type WebsiteReviewModerationSql,
} from "../src/lib/website-review-moderation";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("website review moderation audit", () => {
  it("accepts only supported review statuses", () => {
    for (const status of WEBSITE_REVIEW_STATUSES) {
      expect(isWebsiteReviewStatus(status)).toBe(true);
    }

    expect(isWebsiteReviewStatus("deleted")).toBe(false);
    expect(isWebsiteReviewStatus("")).toBe(false);
    expect(isWebsiteReviewStatus(null)).toBe(false);
  });

  it("locks, updates and audits a workspace review in one SQL statement", async () => {
    const calls: Array<{ query: string; values: readonly unknown[] }> = [];
    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: readonly unknown[]) => {
      calls.push({
        query: strings.join("$value").replace(/\s+/g, " ").trim(),
        values,
      });
      return [{ id: "audit-id" }];
    }) as unknown as WebsiteReviewModerationSql;

    const rows = await persistWebsiteReviewModeration({
      sql,
      actorUserId: "workspace-manager",
      workspaceId: "d83e2f42-0c6f-4d12-a06d-9d455c432f30",
      reviewId: "e9801b25-4ed8-4f93-864d-23ee7f822bc8",
      nextStatus: "approved",
    });

    expect(rows).toEqual([{ id: "audit-id" }]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.query).toContain("with previous as");
    expect(calls[0]?.query).toContain("for update");
    expect(calls[0]?.query).toContain("and workspace_id = $value::uuid");
    expect(calls[0]?.query).toContain("update website_reviews");
    expect(calls[0]?.query).toContain("insert into admin_audit_logs");
    expect(calls[0]?.query).toContain("'website_review.status_updated'");
    expect(calls[0]?.query).toContain("previous_value, new_value");
    expect(calls[0]?.query).not.toContain("message");
    expect(calls[0]?.values).toContain("workspace-manager");
    expect(calls[0]?.values).toContain("d83e2f42-0c6f-4d12-a06d-9d455c432f30");
    expect(calls[0]?.values).toContain("e9801b25-4ed8-4f93-864d-23ee7f822bc8");
    expect(calls[0]?.values).toContain("approved");
  });

  it("keeps permission and workspace scope checks before the audited helper", () => {
    const code = source("src/lib/website-reviews-db.ts");
    const permissionCheck = code.indexOf("canManageWorkspaceSettings(access)");
    const mutationCall = code.indexOf("persistWebsiteReviewModeration({");

    expect(permissionCheck).toBeGreaterThan(-1);
    expect(mutationCall).toBeGreaterThan(permissionCheck);
    expect(code).toContain("workspaceId: access.workspaceId");
    expect(code).toContain("actorUserId: access.userId");
  });
});
