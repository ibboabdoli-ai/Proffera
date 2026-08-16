import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Secondary workspace UX 2.0", () => {
  it("scopes the semantic presentation layer across analytics, reviews and settings", () => {
    const css = source("src/components/dashboard/secondary-workspace-ux-2.module.css");
    const analyticsLayout = source("src/app/dashboard/analys/layout.tsx");
    const reviewsLayout = source("src/app/dashboard/omdomen/layout.tsx");
    const settingsLayout = source("src/app/dashboard/installningar/layout.tsx");

    expect(css).toContain("var(--pf-surface)");
    expect(css).toContain("var(--pf-brand)");
    expect(css).toContain("var(--pf-line)");
    expect(css).toContain("var(--pf-radius-control)");
    expect(css).toContain("prefers-reduced-motion");
    expect(analyticsLayout).toContain("styles.scope");
    expect(reviewsLayout).toContain('featureKey="verified_reviews"');
    expect(reviewsLayout).toContain("styles.scope");
    expect(settingsLayout).toContain("styles.scope");
    expect(settingsLayout).toContain("usePathname");
    expect(settingsLayout).toContain("useSearchParams");
  });

  it("preserves analytics workspace and feature access with the existing 30-day query", () => {
    const analytics = source("src/app/dashboard/analys/page.tsx");

    expect(analytics).toContain("getUserWorkspaceAccess");
    expect(analytics).toContain('hasDashboardFeatureAccess("analytics")');
    expect(analytics).toContain("getDashboardPublicBusinessAnalytics(30)");
    expect(analytics).toContain("summary.actionRate.toFixed(1)");
  });

  it("preserves review moderation, verified invitation and destructive-action boundaries", () => {
    const reviews = source("src/app/dashboard/omdomen/page.tsx");
    const invitations = source("src/app/dashboard/omdomen/inbjudningar/page.tsx");

    expect(reviews).toContain("canManageWorkspaceSettings(access)");
    expect(reviews).toContain("updateDashboardWebsiteReviewStatus");
    expect(reviews).toContain("updateDashboardWebsiteReviewPresentation");
    expect(reviews).toContain("updateDashboardWebsiteReview");
    expect(reviews).toContain("deleteDashboardWebsiteReview");
    expect(reviews).toContain('confirmation !== "DELETE"');
    expect(invitations).toContain("canManageWorkspaceSettings(access)");
    expect(invitations).toContain("getReviewInvitationDashboardContext");
    expect(invitations).toContain("listReviewInvitationCandidates");
  });

  it("preserves settings permissions, password security and Stripe endpoints", () => {
    const settings = source("src/app/dashboard/installningar/page.tsx");
    const settingsAction = source("src/app/dashboard/installningar/actions.ts");
    const security = source("src/app/dashboard/installningar/account-security-card.tsx");
    const billing = source("src/app/dashboard/installningar/workspace-billing-card.tsx");

    expect(settings).toContain("canManageWorkspaceSettings(access)");
    expect(settings).toContain("canManageWorkspaceMembers(access)");
    expect(settings).toContain("getWorkspaceBillingSummary(access.workspaceId)");
    expect(settings).toContain("isStripeCheckoutConfigured()");
    expect(settingsAction).toContain("canManageWorkspaceSettings(workspaceAccess)");
    expect(settingsAction).toContain("updateDashboardWorkspaceSettings");
    expect(settingsAction).toContain("resolveWorkspaceMarket");
    expect(security).toContain('fetch("/api/auth/change-password"');
    expect(security).toContain("revokeOtherSessions: true");
    expect(billing).toContain('fetch("/api/stripe/checkout"');
    expect(billing).toContain('fetch("/api/stripe/upgrade"');
    expect(billing).toContain('fetch("/api/stripe/portal"');
  });
});
