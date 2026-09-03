import { describe, expect, it } from "vitest";

import {
  PREVIEW_MARKETPLACE_E2E_BRANCH,
  isPreviewMarketplaceE2eRuntime,
  previewMarketplaceE2eCustomerEmail,
  previewMarketplaceE2eProviderEmail,
  previewMarketplaceE2eToken,
  resolvePreviewMarketplaceE2eRunId,
} from "@/lib/preview-marketplace-e2e";

const runId = "a".repeat(48);

function previewEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return {
    VERCEL_ENV: "preview",
    VERCEL_GIT_COMMIT_REF: PREVIEW_MARKETPLACE_E2E_BRANCH,
    ...overrides,
    NODE_ENV: "test",
  };
}

describe("Preview Marketplace E2E guard", () => {
  it("activates only on the exact isolated Preview branch", () => {
    expect(isPreviewMarketplaceE2eRuntime(previewEnv())).toBe(true);
    expect(isPreviewMarketplaceE2eRuntime(previewEnv({ VERCEL_ENV: "production" }))).toBe(false);
    expect(isPreviewMarketplaceE2eRuntime(previewEnv({ VERCEL_GIT_COMMIT_REF: "main" }))).toBe(false);
  });

  it("rejects missing, malformed, or non-Preview run headers", () => {
    expect(resolvePreviewMarketplaceE2eRunId(new Headers(), previewEnv())).toBeNull();
    expect(resolvePreviewMarketplaceE2eRunId(new Headers({ "x-proffera-preview-e2e-run": "not-a-run" }), previewEnv())).toBeNull();
    expect(resolvePreviewMarketplaceE2eRunId(new Headers({ "x-proffera-preview-e2e-run": runId }), previewEnv({ VERCEL_ENV: "production" }))).toBeNull();
    expect(resolvePreviewMarketplaceE2eRunId(new Headers({ "x-proffera-preview-e2e-run": runId }), previewEnv())).toBe(runId);
  });

  it("derives only synthetic invalid-domain customer and provider addresses", () => {
    expect(previewMarketplaceE2eCustomerEmail(runId)).toMatch(/^marketplace-e2e-[a-f0-9]+@customer\.example\.invalid$/u);
    expect(previewMarketplaceE2eProviderEmail(runId)).toMatch(/^offers@preview-e2e-vvs-[a-f0-9]+\.example\.invalid$/u);
  });

  it("derives deterministic raw tokens only inside the exact Preview runtime", () => {
    const token = previewMarketplaceE2eToken("guest", runId, previewEnv());
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(previewMarketplaceE2eToken("guest", runId, previewEnv())).toBe(token);
    expect(previewMarketplaceE2eToken("guest", runId, previewEnv({ VERCEL_ENV: "production" }))).toBeNull();
  });
});
