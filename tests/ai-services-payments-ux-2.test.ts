import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("AI, services and payments UX 2.0", () => {
  it("applies the existing semantic workspace presentation layer to AI Assistant", () => {
    const layout = source("src/app/dashboard/ai-assistent/layout.tsx");
    const css = source("src/components/dashboard/secondary-workspace-ux-2.module.css");

    expect(layout).toContain("secondary-workspace-ux-2.module.css");
    expect(layout).toContain("styles.scope");
    expect(css).toContain("var(--pf-surface)");
    expect(css).toContain("var(--pf-brand)");
    expect(css).toContain("var(--pf-radius-control)");
    expect(css).toContain("prefers-reduced-motion");
  });

  it("preserves AI tenant isolation, entitlement and activation/sync endpoints", () => {
    const ai = source("src/app/dashboard/ai-assistent/page.tsx");

    expect(ai).toContain('hasDashboardFeatureAccess("ai_assistant")');
    expect(ai).toContain("getUserWorkspaceAccess");
    expect(ai).toContain("getWorkspaceAiChatIntegration(access.workspaceId)");
    expect(ai).toContain("isServiceAiChatBridgeConfigured()");
    expect(ai).toContain('"/api/ai-chat/activate"');
    expect(ai).toContain('"/api/ai-chat/sync-booking-page"');
    expect(ai).toContain("encodeURIComponent(tenantId)");
  });

  it("preserves workspace service validation, permissions and field contracts", () => {
    const services = source("src/app/dashboard/installningar/services-read-only.tsx");
    const actions = source("src/app/dashboard/installningar/service-actions.ts");
    const settingsLayout = source("src/app/dashboard/installningar/layout.tsx");

    expect(settingsLayout).toContain("styles.scope");
    expect(services).toContain("createWorkspaceServiceAction");
    expect(services).toContain("updateWorkspaceServiceAction");
    expect(services).toContain('name="price_type"');
    expect(services).toContain('name="price_amount"');
    expect(services).toContain('name="public_status"');
    expect(services).toContain('name="conversion_mode"');
    expect(actions).toContain("canManageWorkspaceSettings");
    expect(actions).toContain("validateWorkspaceServiceDraft");
    expect(actions).toContain("validateWorkspaceServicePrice");
    expect(actions).toContain("createDashboardWorkspaceService");
    expect(actions).toContain("updateDashboardWorkspaceService");
  });

  it("preserves Stripe Connect and service-job payment boundaries", () => {
    const payments = source("src/app/dashboard/installningar/betalningar/page.tsx");
    const creator = source("src/app/dashboard/installningar/betalningar/payment-link-creator.tsx");
    const settingsLayout = source("src/app/dashboard/installningar/layout.tsx");

    expect(settingsLayout).toContain("styles.scope");
    expect(payments).toContain('hasWorkspaceFeature("payments")');
    expect(payments).toContain("canManageWorkspaceMembers(access)");
    expect(payments).toContain("getWorkspacePaymentAccount(access.workspaceId)");
    expect(payments).toContain("syncWorkspaceStripeConnectAccount(access.workspaceId)");
    expect(payments).toContain('action="/api/stripe/connect/onboard"');
    expect(creator).toContain('fetch("/api/dashboard/service-job-payments"');
    expect(creator).toContain('method: "POST"');
    expect(creator).toContain("JSON.stringify({ jobId })");
  });
});
