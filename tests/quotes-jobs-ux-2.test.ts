import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Quotes and Jobs UX 2.0", () => {
  it("scopes the semantic presentation layer without weakening the quote module guard", () => {
    const css = source("src/components/dashboard/quotes-jobs-ux-2.module.css");
    const quoteLayout = source("src/app/dashboard/offerter/layout.tsx");
    const jobsLayout = source("src/app/dashboard/uppdrag/layout.tsx");

    expect(css).toContain("var(--pf-surface)");
    expect(css).toContain("var(--pf-brand)");
    expect(css).toContain("var(--pf-line)");
    expect(css).toContain("var(--pf-radius-control)");
    expect(css).toContain("var(--pf-shadow-card)");
    expect(css).toContain("prefers-reduced-motion");
    expect(quoteLayout).toContain('featureKey="quote_management"');
    expect(quoteLayout).toContain("styles.scope");
    expect(jobsLayout).toContain("styles.scope");
  });

  it("preserves quote amount, VAT, transition and email-delivery behavior", () => {
    const detail = source("src/app/dashboard/offerter/[id]/page.tsx");
    const editor = source("src/app/dashboard/offerter/[id]/offer/[offerId]/page.tsx");
    const action = source("src/app/dashboard/offerter/[id]/actions.ts");

    expect(detail).toContain("validateWorkspaceQuoteOfferDraft");
    expect(detail).toContain("createDashboardWorkspaceQuoteOfferDraft");
    expect(detail).toContain("transitionDashboardWorkspaceQuoteRequest");
    expect(detail).toContain("getWorkspaceQuoteTransitions");
    expect(editor).toContain("validateWorkspaceQuoteOfferDraft");
    expect(editor).toContain("updateDashboardWorkspaceQuoteOfferDraft");
    expect(editor).toContain('name="expectedUpdatedAt"');
    expect(action).toContain("prepareDashboardWorkspaceQuoteOfferEmailDelivery");
    expect(action).toContain("completeDashboardWorkspaceQuoteOfferEmailDelivery");
    expect(action).toContain("sendWorkspaceQuoteOfferEmail");
    expect(action).toContain("createPublicWorkspaceQuoteOfferPdf");
  });

  it("preserves job assignment, transitions, evidence, notes and attachment boundaries", () => {
    const detail = source("src/app/dashboard/uppdrag/[id]/page.tsx");
    const detailLayout = source("src/app/dashboard/uppdrag/[id]/layout.tsx");
    const attachments = source("src/app/dashboard/uppdrag/[id]/attachment-manager.tsx");

    expect(detail).toContain("assignDashboardWorkspaceServiceJob");
    expect(detail).toContain("transitionDashboardWorkspaceServiceJob");
    expect(detail).toContain("addDashboardWorkspaceServiceJobNote");
    expect(detail).toContain("getWorkspaceServiceJobTransitions");
    expect(detail).toContain('name="evidence"');
    expect(detail).toContain('name="staffId"');
    expect(detailLayout).toContain("getDashboardServiceJobAttachments");
    expect(detailLayout).toContain("canManageWorkspaceSettings(access)");
    expect(attachments).toContain('action="/api/dashboard/service-jobs/attachments"');
    expect(attachments).toContain('name="jobId"');
    expect(attachments).toContain('accept="application/pdf,image/jpeg,image/png,image/webp"');
  });
});
