import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Company Directory revalidation reliability", () => {
  it("drains two bounded batches per scheduler wake-up without changing the five-minute cadence", () => {
    const workflow = source(".github/workflows/company-directory-revalidation.yml");

    expect(workflow).toContain('cron: "*/5 * * * *"');
    expect(workflow).toContain("BATCHES_PER_RUN=2");
    expect(workflow).toContain('for batch in $(seq 1 "$BATCHES_PER_RUN")');
    expect(workflow).toContain("/api/cron/company-directory-revalidation");
    expect(workflow).not.toContain("/api/cron/company-directory-sync");
  });

  it("retries transient SCB failures only once and keeps request spacing in the retry path", () => {
    const transport = source("src/lib/company-directory-scb-transport.ts");

    expect(transport).toContain("const REQUEST_SPACING_MS = 1_050");
    expect(transport).toContain("const MAX_TRANSIENT_ATTEMPTS = 2");
    expect(transport).toContain("export function isRetryableScbTransportError");
    expect(transport).toContain('"ECONNRESET"');
    expect(transport).toContain("RETRYABLE_HTTP_STATUSES");
    expect(transport).toContain("await reserveRequestSlot()");
    expect(transport).toContain("await delay(RETRY_BACKOFF_MS * attempt)");
  });
});
