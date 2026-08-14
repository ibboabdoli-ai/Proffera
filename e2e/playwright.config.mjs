import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, devices } from "@playwright/test";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(configDir, "..");
const localBaseUrl = "http://127.0.0.1:3000";
const baseURL = process.env.E2E_BASE_URL ?? localBaseUrl;
const parsedBaseUrl = new URL(baseURL);
const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const productionHosts = new Set(["proffera.se", "www.proffera.se"]);
const isLocal = localHosts.has(parsedBaseUrl.hostname);

if (productionHosts.has(parsedBaseUrl.hostname)) {
  throw new Error("Playwright E2E is intentionally blocked from running against Proffera Production.");
}

if (!isLocal && process.env.E2E_ALLOW_REMOTE !== "true") {
  throw new Error(
    "Remote Playwright targets require E2E_ALLOW_REMOTE=true after Preview/Staging isolation has been verified.",
  );
}

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
    trace: "retain-on-failure",
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
        command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
        cwd: repositoryRoot,
        url: localBaseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        stdout: "ignore",
        stderr: "pipe",
      }
    : undefined,
});
