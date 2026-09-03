import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(configDir, "..");
const localBaseUrl = "http://127.0.0.1:3000";
const baseURL = process.env.E2E_BASE_URL ?? localBaseUrl;
const parsedBaseUrl = new URL(baseURL);
const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
const productionHosts = new Set(["proffera.se", "www.proffera.se", "chat.proffera.se"]);
const isLocal = localHosts.has(parsedBaseUrl.hostname);
const marketplacePreviewLifecycle = process.env.E2E_MARKETPLACE_PREVIEW_LIFECYCLE === "true";
const previewOidcToken = String(process.env.PROFFERA_PREVIEW_E2E_OIDC_TOKEN ?? "").trim();
const previewOidcTokenPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u;
const previewAuthCookieName = "__Secure-proffera-preview-e2e-auth";

if (productionHosts.has(parsedBaseUrl.hostname)) {
  throw new Error("Playwright E2E is intentionally blocked from running against Proffera Production.");
}

if (isLocal && parsedBaseUrl.protocol !== "http:") {
  throw new Error("Local Playwright targets must use http://.");
}

if (isLocal && !parsedBaseUrl.port) {
  throw new Error("Local Playwright targets must include an explicit port.");
}

if (!isLocal && process.env.E2E_ALLOW_REMOTE !== "true") {
  throw new Error(
    "Remote Playwright targets require E2E_ALLOW_REMOTE=true after Preview/Staging isolation has been verified.",
  );
}

if (marketplacePreviewLifecycle && !isLocal) {
  if (parsedBaseUrl.protocol !== "https:" || !parsedBaseUrl.hostname.endsWith(".vercel.app")) {
    throw new Error("Marketplace Preview lifecycle requires an exact HTTPS Vercel Preview target.");
  }
  if (!previewOidcToken || previewOidcToken.length > 16_000 || !previewOidcTokenPattern.test(previewOidcToken)) {
    throw new Error("Marketplace Preview lifecycle requires a valid GitHub Actions OIDC credential.");
  }
}

if (previewOidcToken && (!marketplacePreviewLifecycle || isLocal)) {
  throw new Error("Preview E2E OIDC credentials are accepted only for the remote Marketplace Preview lifecycle.");
}

const previewAuthStorageState = previewOidcToken
  ? {
      cookies: [
        {
          name: previewAuthCookieName,
          value: previewOidcToken,
          domain: parsedBaseUrl.hostname,
          path: "/api/e2e/marketplace/",
          expires: -1,
          httpOnly: true,
          secure: true,
          sameSite: "Strict",
        },
      ],
      origins: [],
    }
  : undefined;

const localServerHost = parsedBaseUrl.hostname === "[::1]" ? "::1" : parsedBaseUrl.hostname;
const localServerPort = parsedBaseUrl.port;
const localServerUrl = parsedBaseUrl.origin;

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e.mjs",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    ...(previewAuthStorageState ? { storageState: previewAuthStorageState } : {}),
    trace: previewOidcToken ? "off" : "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: isLocal
    ? {
        command: `npm run dev -- --hostname ${localServerHost} --port ${localServerPort}`,
        cwd: repositoryRoot,
        url: localServerUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "ignore",
        stderr: "pipe",
      }
    : undefined,
});
