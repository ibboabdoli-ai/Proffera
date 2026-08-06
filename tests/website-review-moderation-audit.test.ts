import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  isWebsiteReviewStatus,
  persistWebsiteReviewDeletion,
  persistWebsiteReviewEdit,
  persistWebsiteReviewModeration,
  WEBSITE_REVIEW_STATUSES,
  websiteReviewEditSchema,
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

  it("normalizes and validates dashboard review edits", () => {
    expect(
      websiteReviewEditSchema.parse({
        reviewerName: "  Alex Smith  ",
        rating: "5",
        service: "  Window cleaning  ",
        area: "   ",
        message: "  Excellent and careful work.  ",
      }),
    ).toEqual({
      reviewerName: "Alex Smith",
      rating: 5,
      service: "Window cleaning",
      area: null,
      message: "Excellent and careful work.",
    });

    expect(
      websiteReviewEditSchema.safeParse({
        reviewerName: "A",
        rating: 6,
        service: "",
        area: "",
        message: "Too short",
      }).success,
    ).toBe(false);
  });

  it("locks, updates and audits a workspace review status in one SQL statement", async () => {
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

  it("locks, edits and audits review content without copying content into audit JSON", async () => {
    const calls: Array<{ query: string; values: readonly unknown[] }> = [];
    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: readonly unknown[]) => {
      calls.push({
        query: strings.join("$value").replace(/\s+/g, " ").trim(),
        values,
      });
      return [{ id: "edit-audit-id" }];
    }) as unknown as WebsiteReviewModerationSql;

    const rows = await persistWebsiteReviewEdit({
      sql,
      actorUserId: "workspace-manager",
      workspaceId: "d83e2f42-0c6f-4d12-a06d-9d455c432f30",
      reviewId: "e9801b25-4ed8-4f93-864d-23ee7f822bc8",
      review: {
        reviewerName: "Alex Smith",
        rating: 5,
        service: "Window cleaning",
        area: "Ealing",
        message: "Excellent and careful work.",
      },
    });

    expect(rows).toEqual([{ id: "edit-audit-id" }]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.query).toContain("with previous as");
    expect(calls[0]?.query).toContain("for update");
    expect(calls[0]?.query).toContain("and workspace_id = $value::uuid");
    expect(calls[0]?.query).toContain("update website_reviews");
    expect(calls[0]?.query).toContain("'website_review.content_updated'");
    expect(calls[0]?.query).toContain("'changed_fields'");
    expect(calls[0]?.query).toContain("select previous.id");
    expect(calls[0]?.query).toContain("where not exists (select 1 from changed)");
    expect(calls[0]?.query).toContain("where exists (select 1 from audited)");
    expect(calls[0]?.query).not.toContain("'reviewer_name', changed");
    expect(calls[0]?.query).not.toContain("'message', changed");
    expect(calls[0]?.values).toContain("Excellent and careful work.");
  });

  it("locks, deletes and audits a workspace review without copying customer content", async () => {
    const calls: Array<{ query: string; values: readonly unknown[] }> = [];
    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: readonly unknown[]) => {
      calls.push({
        query: strings.join("$value").replace(/\s+/g, " ").trim(),
        values,
      });
      return [{ id: "deleted-review-id" }];
    }) as unknown as WebsiteReviewModerationSql;

    const rows = await persistWebsiteReviewDeletion({
      sql,
      actorUserId: "workspace-manager",
      workspaceId: "d83e2f42-0c6f-4d12-a06d-9d455c432f30",
      reviewId: "e9801b25-4ed8-4f93-864d-23ee7f822bc8",
    });

    expect(rows).toEqual([{ id: "deleted-review-id" }]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.query).toContain("with previous as");
    expect(calls[0]?.query).toContain("for update");
    expect(calls[0]?.query).toContain("and workspace_id = $value::uuid");
    expect(calls[0]?.query).toContain("delete from website_reviews");
    expect(calls[0]?.query).toContain("insert into admin_audit_logs");
    expect(calls[0]?.query).toContain("'website_review.deleted'");
    expect(calls[0]?.query).toContain("'is_verified', previous.is_verified");
    expect(calls[0]?.query).not.toContain("reviewer_name");
    expect(calls[0]?.query).not.toContain("message");
    expect(calls[0]?.values).toContain("workspace-manager");
    expect(calls[0]?.values).toContain("d83e2f42-0c6f-4d12-a06d-9d455c432f30");
    expect(calls[0]?.values).toContain("e9801b25-4ed8-4f93-864d-23ee7f822bc8");
  });

  it("keeps permission and workspace scope checks before audited mutations", () => {
    const code = source("src/lib/website-reviews-db.ts");
    const moderationSection = code.slice(
      code.indexOf("export async function updateDashboardWebsiteReviewStatus"),
      code.indexOf("export async function updateDashboardWebsiteReview("),
    );
    const editSection = code.slice(
      code.indexOf("export async function updateDashboardWebsiteReview("),
      code.indexOf("export async function deleteDashboardWebsiteReview("),
    );
    const deleteSection = code.slice(code.indexOf("export async function deleteDashboardWebsiteReview("));

    expect(moderationSection).toContain("canManageWorkspaceSettings(access)");
    expect(moderationSection).toContain("persistWebsiteReviewModeration({");
    expect(moderationSection).toContain("workspaceId: access.workspaceId");
    expect(moderationSection).toContain("actorUserId: access.userId");

    expect(editSection).toContain("websiteReviewEditSchema.safeParse(input)");
    expect(editSection).toContain("canManageWorkspaceSettings(access)");
    expect(editSection).toContain("persistWebsiteReviewEdit({");
    expect(editSection).toContain("workspaceId: access.workspaceId");
    expect(editSection).toContain("actorUserId: access.userId");

    expect(deleteSection).toContain("canManageWorkspaceSettings(access)");
    expect(deleteSection).toContain("persistWebsiteReviewDeletion({");
    expect(deleteSection).toContain("workspaceId: access.workspaceId");
    expect(deleteSection).toContain("actorUserId: access.userId");
  });

  it("exposes bilingual bounded edit and confirmed deletion forms", () => {
    const page = source("src/app/dashboard/omdomen/page.tsx");

    expect(page).toContain("editReviewAction");
    expect(page).toContain('name="reviewer_name"');
    expect(page).toContain('name="rating"');
    expect(page).toContain('name="service"');
    expect(page).toContain('name="area"');
    expect(page).toContain('name="message"');
    expect(page).toContain("Edit review");
    expect(page).toContain("Redigera omdöme");
    expect(page).toContain("maxLength={1_000}");

    expect(page).toContain("deleteReviewAction");
    expect(page).toContain("deleteDashboardWebsiteReview");
    expect(page).toContain('name="confirmation"');
    expect(page).toContain('pattern="DELETE"');
    expect(page).toContain("Permanently delete review");
    expect(page).toContain("Radera omdömet permanent");
  });
});
