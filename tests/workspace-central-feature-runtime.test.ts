import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("central workspace feature runtime", () => {
  it("uses canonical catalog keys for dashboard modules", () => {
    const code = source("src/lib/workspace-module-access.ts");

    expect(code).toContain('online_booking: ["online_booking"]');
    expect(code).toContain('customer_crm: ["customer_crm"]');
    expect(code).toContain('ai_chat: ["ai_chatbot"]');
    expect(code).toContain('email_automation: ["booking_reminders"]');
    expect(code).not.toContain('online_booking: ["booking_demo"]');
    expect(code).not.toContain('customer_crm: ["crm_customers"]');
  });

  it("makes central features control navigation and direct routes", () => {
    const navigation = source("src/lib/proffera-modules.ts");
    const shell = source("src/components/dashboard/dashboard-shell.tsx");
    const leads = source("src/app/dashboard/leads/layout.tsx");
    const offers = source("src/app/dashboard/offerter/layout.tsx");
    const gallery = source("src/app/dashboard/galleri/layout.tsx");
    const reviews = source("src/app/dashboard/omdomen/layout.tsx");

    expect(navigation).toContain('featureKey: "lead_management"');
    expect(navigation).toContain('featureKey: "quote_management"');
    expect(navigation).toContain('featureKey: "media_gallery"');
    expect(navigation).toContain('featureKey: "verified_reviews"');
    expect(shell).not.toContain('workspaceSlug !== "primeview-window-care"');
    expect(leads).toContain('featureKey="lead_management"');
    expect(offers).toContain('featureKey="quote_management"');
    expect(gallery).toContain('featureKey="media_gallery"');
    expect(reviews).toContain('featureKey="verified_reviews"');
  });

  it("keeps the database entitlement calculation as the single runtime source", () => {
    const code = source("src/lib/workspace-module-access.ts");

    expect(code).toContain("getWorkspaceEntitlements");
    expect(code).not.toContain("from workspace_feature_flags");
    expect(code).not.toContain("latest_plan");
  });
});
