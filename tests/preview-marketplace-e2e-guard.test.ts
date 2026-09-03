import { createSign, generateKeyPairSync, type KeyObject } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  PREVIEW_MARKETPLACE_E2E_AUTH_COOKIE,
  PREVIEW_MARKETPLACE_E2E_BRANCH,
  PREVIEW_MARKETPLACE_E2E_HEADER,
  PREVIEW_MARKETPLACE_E2E_OIDC_AUDIENCE,
  isPreviewMarketplaceE2eRuntime,
  previewMarketplaceE2eCoordinates,
  previewMarketplaceE2eCustomerEmail,
  previewMarketplaceE2eProviderEmail,
  previewMarketplaceE2eToken,
  resolveAuthorizedPreviewMarketplaceE2eRunId,
  resolvePreviewMarketplaceE2eRunId,
} from "@/lib/preview-marketplace-e2e";

const runId = "a".repeat(48);
const nowMs = Date.UTC(2026, 8, 3, 12, 0, 0);
const nowSeconds = Math.floor(nowMs / 1000);
const repository = "ibboabdoli-ai/Proffera";
const repositoryId = "1267669271";
const workflow = "Marketplace Preview browser E2E";
const pullRequestRef = "refs/pull/813/merge";
const workflowRef = `${repository}/.github/workflows/marketplace-preview-browser-e2e.yml@${pullRequestRef}`;

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

function encodedJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signingFixture(kid = "preview-e2e-test-key") {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = publicKey.export({ format: "jwk" });
  const fetchImpl = async () => new Response(JSON.stringify({
    keys: [{ ...jwk, kid, alg: "RS256", use: "sig" }],
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  return { privateKey, fetchImpl, kid };
}

function baseClaims(overrides: Record<string, unknown> = {}) {
  return {
    iss: "https://token.actions.githubusercontent.com",
    aud: PREVIEW_MARKETPLACE_E2E_OIDC_AUDIENCE,
    sub: `repo:${repository}:pull_request`,
    repository,
    repository_id: repositoryId,
    event_name: "pull_request",
    head_ref: PREVIEW_MARKETPLACE_E2E_BRANCH,
    base_ref: "main",
    ref: pullRequestRef,
    workflow,
    workflow_ref: workflowRef,
    runner_environment: "github-hosted",
    iat: nowSeconds - 30,
    nbf: nowSeconds - 30,
    exp: nowSeconds + 300,
    ...overrides,
  };
}

function signedToken(privateKey: KeyObject, kid: string, claims: Record<string, unknown>) {
  const header = encodedJson({ typ: "JWT", alg: "RS256", kid });
  const payload = encodedJson(claims);
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();
  const signature = signer.sign(privateKey).toString("base64url");
  return `${header}.${payload}.${signature}`;
}

function authorizedHeaders(token: string | null) {
  const headers = new Headers({ [PREVIEW_MARKETPLACE_E2E_HEADER]: runId });
  if (token) headers.set("cookie", `${PREVIEW_MARKETPLACE_E2E_AUTH_COOKIE}=${token}`);
  return headers;
}

describe("Preview Marketplace E2E guard", () => {
  it("activates only on the exact isolated Preview branch", () => {
    expect(isPreviewMarketplaceE2eRuntime(previewEnv())).toBe(true);
    expect(isPreviewMarketplaceE2eRuntime(previewEnv({ VERCEL_ENV: "production" }))).toBe(false);
    expect(isPreviewMarketplaceE2eRuntime(previewEnv({ VERCEL_GIT_COMMIT_REF: "main" }))).toBe(false);
  });

  it("keeps the run ID as synthetic scope only", () => {
    expect(resolvePreviewMarketplaceE2eRunId(new Headers(), previewEnv())).toBeNull();
    expect(resolvePreviewMarketplaceE2eRunId(new Headers({ [PREVIEW_MARKETPLACE_E2E_HEADER]: "not-a-run" }), previewEnv())).toBeNull();
    expect(resolvePreviewMarketplaceE2eRunId(new Headers({ [PREVIEW_MARKETPLACE_E2E_HEADER]: runId }), previewEnv({ VERCEL_ENV: "production" }))).toBeNull();
    expect(resolvePreviewMarketplaceE2eRunId(new Headers({ [PREVIEW_MARKETPLACE_E2E_HEADER]: runId }), previewEnv())).toBe(runId);
  });

  it("rejects a missing OIDC credential", async () => {
    const { fetchImpl } = signingFixture();
    await expect(resolveAuthorizedPreviewMarketplaceE2eRunId(
      authorizedHeaders(null),
      previewEnv(),
      { fetchImpl, nowMs },
    )).resolves.toBeNull();
  });

  it("rejects a malformed OIDC credential", async () => {
    const { fetchImpl } = signingFixture();
    await expect(resolveAuthorizedPreviewMarketplaceE2eRunId(
      authorizedHeaders("not-a-jwt"),
      previewEnv(),
      { fetchImpl, nowMs },
    )).resolves.toBeNull();
  });

  it("rejects an invalid OIDC signature", async () => {
    const trusted = signingFixture();
    const untrusted = signingFixture(trusted.kid);
    const token = signedToken(untrusted.privateKey, trusted.kid, baseClaims());
    await expect(resolveAuthorizedPreviewMarketplaceE2eRunId(
      authorizedHeaders(token),
      previewEnv(),
      { fetchImpl: trusted.fetchImpl, nowMs },
    )).resolves.toBeNull();
  });

  it.each([
    ["audience", { aud: "not-proffera-marketplace-preview-e2e" }],
    ["repository", { repository: "attacker/Proffera" }],
    ["repository id", { repository_id: "999999" }],
    ["event", { event_name: "push" }],
    ["head ref", { head_ref: "main" }],
    ["workflow", { workflow: "Other workflow" }],
    ["workflow ref", { workflow_ref: "ibboabdoli-ai/Proffera/.github/workflows/other.yml@refs/pull/813/merge" }],
  ])("rejects the wrong OIDC %s claim", async (_label, override) => {
    const fixture = signingFixture();
    const token = signedToken(fixture.privateKey, fixture.kid, baseClaims(override));
    await expect(resolveAuthorizedPreviewMarketplaceE2eRunId(
      authorizedHeaders(token),
      previewEnv(),
      { fetchImpl: fixture.fetchImpl, nowMs },
    )).resolves.toBeNull();
  });

  it.each([
    ["expired", { iat: nowSeconds - 120, nbf: nowSeconds - 120, exp: nowSeconds - 60 }],
    ["stale", { iat: nowSeconds - (16 * 60), nbf: nowSeconds - (16 * 60), exp: nowSeconds + 60 }],
    ["future", { iat: nowSeconds + 60, nbf: nowSeconds + 60, exp: nowSeconds + 360 }],
  ])("rejects an %s OIDC credential", async (_label, override) => {
    const fixture = signingFixture();
    const token = signedToken(fixture.privateKey, fixture.kid, baseClaims(override));
    await expect(resolveAuthorizedPreviewMarketplaceE2eRunId(
      authorizedHeaders(token),
      previewEnv(),
      { fetchImpl: fixture.fetchImpl, nowMs },
    )).resolves.toBeNull();
  });

  it("accepts a valid locally signed exact-workflow OIDC credential", async () => {
    const fixture = signingFixture();
    const token = signedToken(fixture.privateKey, fixture.kid, baseClaims());
    await expect(resolveAuthorizedPreviewMarketplaceE2eRunId(
      authorizedHeaders(token),
      previewEnv(),
      { fetchImpl: fixture.fetchImpl, nowMs },
    )).resolves.toBe(runId);
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
