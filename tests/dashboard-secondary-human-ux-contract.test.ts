import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("dashboard secondary human-designed UX contract", () => {
  it("keeps jobs operational and status-driven", () => {
    const jobs = source("src/app/dashboard/uppdrag/page.tsx");

    expect(jobs).toContain("getDashboardWorkspaceServiceJobs()");
    expect(jobs).toContain("statusTone");
    expect(jobs).toContain("bg-brand-deep");
    expect(jobs).toContain("DashboardDataPanel");
    expect(jobs).not.toContain("bg-[#173e2b]");
  });

  it("keeps review moderation truthful while using the workspace visual system", () => {
    const reviews = source("src/app/dashboard/omdomen/page.tsx");

    expect(reviews).toContain("updateDashboardWebsiteReviewStatus");
    expect(reviews).toContain("updateDashboardWebsiteReviewPresentation");
    expect(reviews).toContain("deleteDashboardWebsiteReview");
    expect(reviews).toContain('confirmation !== "DELETE"');
    expect(reviews).toContain("rounded-card border border-line bg-surface");
    expect(reviews).toContain("bg-[#eaf8f2] text-[#087754]");
  });

  it("reduces analytics card fragmentation without changing the 30-day data source", () => {
    const analytics = source("src/app/dashboard/analys/page.tsx");

    expect(analytics).toContain("getDashboardPublicBusinessAnalytics(30)");
    expect(analytics).toContain("summary.actionRate.toFixed(1)");
    expect(analytics).toContain("md:divide-x");
    expect(analytics).toContain("divide-y divide-line");
    expect(analytics).not.toContain("bg-[#f3eefc]");
  });

  it("turns AI Chat into an operational workspace instead of a decorative AI dashboard", () => {
    const ai = source("src/app/dashboard/ai-assistent/page.tsx");

    expect(ai).toContain('hasDashboardFeatureAccess("ai_assistant")');
    expect(ai).toContain("getWorkspaceAiChatIntegration(access.workspaceId)");
    expect(ai).toContain('"/api/ai-chat/activate"');
    expect(ai).toContain('"/api/ai-chat/sync-booking-page"');
    expect(ai).toContain("DashboardPageHeader");
    expect(ai).toContain("divide-y divide-line");
    expect(ai).not.toContain('bg-[#17452f]');
  });

  it("keeps gallery media actions intact while making the manager data-led", () => {
    const gallery = source("src/app/dashboard/galleri/page.tsx");

    expect(gallery).toContain("canManageWorkspaceSettings(access)");
    expect(gallery).toContain('action="/api/dashboard/gallery/upload"');
    expect(gallery).toContain('"publish" | "hide" | "delete"');
    expect(gallery).toContain("updateGalleryItem(id, action)");
    expect(gallery).toContain("DashboardPageHeader");
    expect(gallery).toContain("publishedCount");
    expect(gallery).toContain("draftCount");
  });
});
