import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  join(process.cwd(), ".github/workflows/marketplace-auto-dispatch.yml"),
  "utf8",
);

describe("Marketplace auto dispatch workflow safety contract", () => {
  it("is dormant until the explicit repository activation variable is true", () => {
    expect(workflow).toContain("vars.MARKETPLACE_AUTO_DISPATCH_ENABLED == 'true'");
    expect(workflow).toContain("schedule:");
    expect(workflow).toContain("workflow_dispatch:");
  });

  it("reuses the protected cron secret and refuses non-HTTPS endpoint configuration", () => {
    expect(workflow).toContain("secrets.PROFFERA_REMINDER_CRON_SECRET");
    expect(workflow).toContain("secrets.PROFFERA_REMINDER_CRON_URL");
    expect(workflow).toContain('url.scheme != "https"');
    expect(workflow).toContain('Authorization: Bearer $CRON_SECRET');
    expect(workflow).toContain("--request POST");
  });

  it("serializes dispatch runs and bounds the remote call", () => {
    expect(workflow).toContain("group: marketplace-auto-dispatch");
    expect(workflow).toContain("cancel-in-progress: false");
    expect(workflow).toContain("--max-time 55");
  });
});
