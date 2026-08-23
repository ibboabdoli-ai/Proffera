import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("Marketplace Auto Worker rollout configuration", () => {
  it("keeps Production rollout bounded and protects the historical backlog", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      env?: Record<string, string>;
    };

    expect(config.env).toMatchObject({
      MARKETPLACE_AUTO_WORKER_ENABLED: "true",
      MARKETPLACE_AUTO_WORKER_ALLOW_PRODUCTION: "true",
      MARKETPLACE_AUTO_WORKER_NOT_BEFORE: "2026-08-23T09:24:45.000Z",
      MARKETPLACE_AUTO_WORKER_BATCH_SIZE: "1",
      MARKETPLACE_AUTO_WAVE2_DELAY_MINUTES: "360",
    });
  });

  it("uses the already-proven scheduler secret without a second repository activation gate", () => {
    const workflow = readFileSync(".github/workflows/marketplace-auto-worker.yml", "utf8");

    expect(workflow).toContain("https://www.proffera.se/api/cron/marketplace-auto-worker");
    expect(workflow).toContain("secrets.PROFFERA_REMINDER_CRON_SECRET");
    expect(workflow).not.toContain("vars.MARKETPLACE_AUTO_WORKER_ENABLED");
    expect(workflow).not.toContain("PROFFERA_MARKETPLACE_AUTO_WORKER_CRON_SECRET");
  });
});
