import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(process.cwd(), "src/app/api/e2e/marketplace/fixture/route.ts"),
  "utf8",
);

describe("Preview Marketplace lifecycle fixture boundary", () => {
  it("requires the authorized Preview resolver and targets only synthetic customer runs", () => {
    expect(source).toContain("isPreviewMarketplaceE2eRuntime()");
    expect(source).toContain("resolveAuthorizedPreviewMarketplaceE2eRunId(request.headers)");
    expect(source).not.toContain("resolvePreviewMarketplaceE2eRunId(request.headers)");
    expect(source).toContain("previewMarketplaceE2eCustomerEmail(runId)");
    expect(source).toContain("targetReferenceIds");
    expect(source).toContain("processMarketplaceAutoWorker");
  });

  it("keeps the published synthetic provider inside the pilot contract and isolates matching per suite run", () => {
    expect(source).toContain('const TEST_CITY = "Stockholm";');
    expect(source).toContain('const TEST_MUNICIPALITY = "Stockholm";');
    expect(source).toContain("previewMarketplaceE2eCoordinates(suiteRunId)");
    expect(source).toContain("${TEST_CITY}, ${TEST_MUNICIPALITY}, ${slug}");
    expect(source).toContain("${profileId}::uuid, ${coordinates.latitude}, ${coordinates.longitude}");
    expect(source).toContain("latitude: coordinates.latitude");
    expect(source).toContain("longitude: coordinates.longitude");
    expect(source).not.toContain('const TEST_CITY = "Preview E2E";');
    expect(source).not.toContain("const TEST_LATITUDE = -80;");
    expect(source).not.toContain("const TEST_LONGITUDE = 170;");
  });

  it("keeps cleanup scoped to deterministic synthetic quote and provider identities", () => {
    expect(source).toContain("where lower(btrim(contact_email)) = ${email}");
    expect(source).toContain("delete from quote_requests where id = ${String(row.id)}::uuid");
    expect(source).toContain("delete from company_directory_profiles where id = ${profileId}::uuid");
    expect(source).toContain("deleteProvider !== false");
    expect(source).not.toContain("truncate table");
  });
});
