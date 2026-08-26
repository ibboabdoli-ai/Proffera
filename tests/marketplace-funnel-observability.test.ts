import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Marketplace funnel observability", () => {
  it("uses a Quote Admin read-only request-level 30-day funnel", () => {
    const funnel = source("src/features/admin/marketplace-funnel.ts");

    expect(funnel).toContain('getAdminForArea("quote_admin")');
    expect(funnel).toContain("now() - interval '30 days'");
    expect(funnel).toContain("marketplace_quote_invitations");
    expect(funnel).toContain("marketplace_quote_offers");
    expect(funnel).toContain("marketplace_service_jobs");
    expect(funnel).toContain("website_reviews");
    expect(funnel).toContain("company_directory_claims");
    expect(funnel).toContain("workspace_billing_subscriptions");
    expect(funnel).toContain("invitation.viewed_at is not null");
    expect(funnel).toContain("invitation.responded_at is not null");
    expect(funnel).toContain("offer.status = 'selected'");
    expect(funnel).toContain("job.status = 'completed'");
    expect(funnel).toContain("job.completed_at is not null");
    expect(funnel).toContain("review.is_verified = true");
    expect(funnel).toContain("review.status = 'approved'");
    expect(funnel).toContain("claim.requested_workspace_id = invitation.workspace_id");
    expect(funnel).toContain("claim.status = 'claimed'");
    expect(funnel).toContain("claim.resolved_at >= request.created_at");
    expect(funnel).toContain("billing.workspace_id = invitation.workspace_id");
    expect(funnel).toContain("billing.stripe_subscription_id is not null");
    expect(funnel).toContain("billing.status in ('active', 'trialing')");
    expect(funnel).toContain("billing.created_at >= claim.resolved_at");
    expect(funnel).not.toMatch(/insert\s+into|update\s+(marketplace_|website_reviews|company_directory_|workspace_billing)|delete\s+from|contact_email|contact_phone/i);
  });

  it("surfaces all request-level stages without adding mutation or ranking controls", () => {
    const page = source("src/app/admin/marketplace/funnel/page.tsx");
    const layout = source("src/app/admin/marketplace/layout.tsx");

    for (const label of [
      "Requests",
      "Invited",
      "Viewed",
      "Responded",
      "Offers",
      "Selected",
      "Service jobs",
      "Completed jobs",
      "Verified reviews",
      "Claimed",
      "Paid",
    ]) {
      expect(page).toContain(label);
    }
    expect(page).toContain("Observability only");
    expect(page).toContain("aldrig ranking- eller trust-signaler");
    expect(page).not.toMatch(/<form|method=["']post|\/api\//i);
    expect(layout).toContain('/admin/marketplace/funnel');
  });
});
