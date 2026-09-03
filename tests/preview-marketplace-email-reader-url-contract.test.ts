import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const routeSource = readFileSync(
  path.join(process.cwd(), "src/app/api/e2e/marketplace/email/route.ts"),
  "utf8",
);

describe("Preview Marketplace email reader URL confinement", () => {
  it("delegates Preview origin and lifecycle-link confinement to the canonical helper", () => {
    expect(routeSource).toContain('from "@/lib/preview-marketplace-email-link"');
    expect(routeSource).toContain("previewMarketplaceEmailOrigin(request.url)");
    expect(routeSource).toContain("await resolvePreviewMarketplaceEmailLink({ body, kind, origin })");
  });
});
