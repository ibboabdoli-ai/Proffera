import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "src/app/api/e2e/marketplace/email/route.ts"),
  "utf8",
);

describe("Preview Marketplace email reader boundary", () => {
  it("uses only canonical Preview email configuration and exact E2E runtime gating", () => {
    expect(source).toContain("isPreviewMarketplaceE2eRuntime()");
    expect(source).toContain("resolvePreviewMarketplaceE2eRunId(request.headers)");
    expect(source).toContain("resolveBrevoApiKey()");
    expect(source).toContain("resolvePreviewEmailRecipient()");
    expect(source).not.toContain("process.env.BREVO_API_KEY");
  });

  it("returns only controlled Preview links and checks the synthetic original recipient", () => {
    expect(source).toContain("url.origin !== origin");
    expect(source).toContain("/offert/svara/");
    expect(source).toContain("/offert/jamfor/");
    expect(source).toContain("/review/marketplace/");
    expect(source).toContain("originalRecipientObserved");
    expect(source).not.toContain("previewRecipient:");
  });

  it("bounds Brevo reads before loading message bodies", () => {
    expect(source).toContain('url.searchParams.set("limit", "20")');
    expect(source).toContain("likelyMarkerCandidate");
    expect(source).toContain("subjectMatch: kind === \"customer\"");
    expect(source).toContain("createdAtMs - 60_000");
    expect(source).toContain('.slice(0, kind === "guest" ? 6 : 3)');
  });
});
