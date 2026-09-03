import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "src/app/api/e2e/marketplace/fixture/route.ts"),
  "utf8",
);

describe("Preview Marketplace lifecycle fixture boundary", () => {
  it("is exact-Preview gated and targets only synthetic customer runs", () => {
    expect(source).toContain("isPreviewMarketplaceE2eRuntime()");
    expect(source).toContain("resolvePreviewMarketplaceE2eRunId(request.headers)");
    expect(source).toContain("previewMarketplaceE2eCustomerEmail(runId)");
    expect(source).toContain("targetReferenceIds");
    expect(source).toContain("processMarketplaceAutoWorker");
  });

  it("keeps cleanup scoped to deterministic synthetic quote and provider identities", () => {
    expect(source).toContain("where lower(btrim(contact_email)) = ${email}");
    expect(source).toContain("delete from quote_requests where id = ${String(row.id)}::uuid");
    expect(source).toContain("delete from company_directory_profiles where id = ${profileId}::uuid");
    expect(source).toContain("deleteProvider !== false");
    expect(source).not.toContain("truncate table");
  });
});
