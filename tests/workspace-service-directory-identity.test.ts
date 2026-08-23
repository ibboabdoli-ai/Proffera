import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const migration = source("db/migrations/20260823_0065_workspace_service_directory_identity.sql");
const servicesDb = source("src/lib/workspace-services-db.ts");
const providerActivation = source("src/lib/company-directory-provider-activation.ts");

describe("Workspace service Directory identity migration", () => {
  it("adds a nullable primary taxonomy reference without replacing the public URL slug", () => {
    expect(migration).toContain("add column if not exists primary_directory_service_slug text");
    expect(migration).toContain("references company_directory_services(slug)");
    expect(migration).toContain("on delete restrict");
    expect(migration).toContain("workspace_services_primary_directory_service_idx");
    expect(migration).toContain("Independent from public_slug");
  });

  it("backfills only exact legacy slug matches and does not fuzzy-infer taxonomy", () => {
    expect(migration).toContain("service.public_slug = directory_service.slug");
    expect(migration).not.toMatch(/lower\(service\.public_slug\)/i);
    expect(migration).not.toMatch(/similarity\(/i);
    expect(migration).not.toMatch(/levenshtein/i);
    expect(migration).not.toMatch(/ilike/i);
  });
});

describe("Workspace service Directory identity runtime bridge", () => {
  it("exposes the durable primary taxonomy identity separately from publicSlug", () => {
    expect(servicesDb).toContain("primaryDirectoryServiceSlug: string");
    expect(servicesDb).toContain("service.primary_directory_service_slug");
    expect(servicesDb).toContain("primaryDirectoryServiceSlug: toText(row.primary_directory_service_slug)");
  });

  it("resolves new taxonomy identity only from an exact claimed Directory relation", () => {
    expect(servicesDb).toContain("resolveExactPrimaryDirectoryServiceSlug");
    expect(servicesDb).toContain("relation.service_slug = ${normalized}");
    expect(servicesDb).toContain("profile.claimed_workspace_id::text = ${workspaceId}");
    expect(servicesDb).toContain("relation.public_visible = true");
  });

  it("uses primary identity for service-area evidence while retaining a legacy read fallback", () => {
    expect(servicesDb).toContain("coalesce(service.primary_directory_service_slug, service.public_slug)");
    expect(servicesDb).toContain("ownerServiceAreaMutationQuery(sql, workspaceId, primaryDirectoryServiceSlug, input)");
    expect(servicesDb).toContain("recoveredLegacyPrimaryDirectoryServiceSlug");
  });

  it("dual-writes provider activation before public Search switches readers", () => {
    expect(providerActivation).toContain("set primary_directory_service_slug = ${input.directoryServiceSlug}");
    expect(providerActivation).toContain("public_slug = ${input.directoryServiceSlug}");
    expect(providerActivation).toContain("coalesce(duplicate.primary_directory_service_slug, duplicate.public_slug)");
  });
});
