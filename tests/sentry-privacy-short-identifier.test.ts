import { describe, expect, it } from "vitest";

import { scrubSentrySpan, scrubSentryTransaction } from "@/lib/observability/sentry-privacy";

describe("Sentry short path identifier privacy", () => {
  it("redacts organization numbers from HTTP span descriptions", () => {
    const organizationNumber = "5566778899";
    const span = scrubSentrySpan({
      data: {
        "http.method": "GET",
        "http.url": `https://example.test/organisationer/${organizationNumber}`,
      },
      description: `GET https://example.test/organisationer/${organizationNumber}?source=private`,
    });

    expect(span.data).toEqual({ "http.method": "GET" });
    expect(span.description).toBe("GET https://example.test/organisationer/[redacted]");
    expect(JSON.stringify(span)).not.toContain(organizationNumber);
  });

  it("redacts short numeric identifiers from transaction names and request URLs", () => {
    const organizationNumber = "5566778899";
    const transaction = scrubSentryTransaction({
      type: "transaction",
      transaction: `GET /organisationer/${organizationNumber}?source=private`,
      request: {
        url: `https://example.test/organisationer/${organizationNumber}?source=private`,
      },
    });

    expect(transaction.transaction).toBe("GET /organisationer/[redacted]");
    expect(transaction.request?.url).toBe("https://example.test/organisationer/[redacted]");
    expect(JSON.stringify(transaction)).not.toContain(organizationNumber);
  });
});
