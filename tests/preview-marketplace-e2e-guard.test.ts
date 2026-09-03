import { describe, expect, it } from "vitest";

import {
  PREVIEW_MARKETPLACE_E2E_BRANCH,
  isPreviewMarketplaceE2eRuntime,
  previewMarketplaceE2eCoordinates,
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

function distanceKm(left: { latitude: number; longitude: number }, right: { latitude: number; longitude: number }) {
  const radians = (value: number) => value * Math.PI / 180;
  const latitudeDelta = radians(right.latitude - left.latitude);
  const longitudeDelta = radians(right.longitude - left.longitude);
  const leftLatitude = radians(left.latitude);
  const rightLatitude = radians(right.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
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

  it("derives deterministic ocean coordinate cells with adjacent cells beyond the 50 km match radius", () => {
    const baseRun = "0".repeat(48);
    const nextLatitudeRun = `00000001${"0".repeat(40)}`;
    const nextLongitudeRun = `0000000000000001${"0".repeat(32)}`;
    const base = previewMarketplaceE2eCoordinates(baseRun);
    const nextLatitude = previewMarketplaceE2eCoordinates(nextLatitudeRun);
    const nextLongitude = previewMarketplaceE2eCoordinates(nextLongitudeRun);

    expect(base).toEqual({ latitude: -70, longitude: -170 });
    expect(previewMarketplaceE2eCoordinates(baseRun)).toEqual(base);
    expect(nextLatitude).not.toBeNull();
    expect(nextLongitude).not.toBeNull();
    expect(distanceKm(base!, nextLatitude!)).toBeGreaterThan(50);
    expect(distanceKm(base!, nextLongitude!)).toBeGreaterThan(50);
    expect(base?.latitude).toBeGreaterThanOrEqual(-70);
    expect(base?.latitude).toBeLessThanOrEqual(-20);
    expect(base?.longitude).toBeGreaterThanOrEqual(-170);
    expect(base?.longitude).toBeLessThanOrEqual(170);
    expect(previewMarketplaceE2eCoordinates("not-a-run")).toBeNull();
  });

  it("derives deterministic raw tokens only inside the exact Preview runtime", () => {
    const token = previewMarketplaceE2eToken("guest", runId, previewEnv());
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(previewMarketplaceE2eToken("guest", runId, previewEnv())).toBe(token);
    expect(previewMarketplaceE2eToken("guest", runId, previewEnv({ VERCEL_ENV: "production" }))).toBeNull();
  });
});
