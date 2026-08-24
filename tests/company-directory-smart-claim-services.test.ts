import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const providerActivation = source("src/lib/company-directory-provider-activation.ts");

describe("Company Directory smart claim service suggestions", () => {
  it("materializes only exact active Directory relations for the claimed workspace", () => {
    expect(providerActivation).toContain("profile.claimed_workspace_id = ${access.workspaceId}::uuid");
    expect(providerActivation).toContain("profile.publication_status = 'claimed'");
    expect(providerActivation).toContain("relation.is_active = true");
    expect(providerActivation).toContain("relation.public_visible = true");
    expect(providerActivation).toContain("service.slug = relation.service_slug");
    expect(providerActivation).toContain("service.is_active = true");
  });

  it("creates owner-visible drafts instead of silently publishing inferred services", () => {
    expect(providerActivation).toContain("primary_directory_service_slug");
    expect(providerActivation).toContain("'draft'");
    expect(providerActivation).toContain("'quote'");
    expect(providerActivation).toContain("explicitly publishes them through activateProviderMarketplaceService");
  });

  it("is idempotent and does not duplicate an existing canonical or legacy service identity", () => {
    expect(providerActivation).toContain("coalesce(nullif(trim(existing.primary_directory_service_slug), ''), existing.public_slug) = service.slug");
    expect(providerActivation).toContain("existing.public_slug = service.slug");
    expect(providerActivation).toContain("lower(trim(existing.name)) = lower(trim(service.label))");
    expect(providerActivation).toContain("on conflict do nothing");
  });

  it("keeps public publication behind the explicit owner activation path", () => {
    expect(providerActivation).toContain("export async function activateProviderMarketplaceService");
    expect(providerActivation).toContain("set primary_directory_service_slug = ${input.directoryServiceSlug}");
    expect(providerActivation).toContain("public_status = 'published'");
    expect(providerActivation).toContain("source_type = 'owner'");
  });
});
