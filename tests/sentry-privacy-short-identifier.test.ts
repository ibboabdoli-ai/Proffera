import { describe, expect, it } from "vitest";

import {
  scrubSentryBreadcrumb,
  scrubSentryEvent,
  scrubSentrySpan,
  scrubSentryTransaction,
} from "@/lib/observability/sentry-privacy";

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


describe("Sentry formatted path PII privacy", () => {
  const privateSegments = [
    ["formatted organization number", "556677-8899"],
    ["formatted person identifier", "19890101-1234"],
    ["email-shaped segment", "private@example.com"],
    ["percent-encoded organization number", "556677%2D8899"],
    ["percent-encoded email", "private%40example.com"],
  ] as const;

  it.each(privateSegments)("redacts %s across every URL-bearing Sentry scrubber", (_label, privateSegment) => {
    const decoded = decodeURIComponent(privateSegment);
    const privatePath = `/customer/${privateSegment}?source=private#fragment`;
    const absoluteUrl = `https://example.test${privatePath}`;

    const event = scrubSentryEvent({
      type: undefined,
      request: { url: absoluteUrl },
      contexts: {
        nextjs: { request_path: privatePath },
      },
    });
    const transaction = scrubSentryTransaction({
      type: "transaction",
      transaction: `GET ${privatePath}`,
      request: { url: absoluteUrl },
    });
    const breadcrumb = scrubSentryBreadcrumb({
      category: "navigation",
      data: { from: privatePath, to: privatePath },
    });
    const span = scrubSentrySpan({
      data: { "http.method": "GET", "http.url": absoluteUrl },
      description: `GET ${absoluteUrl}`,
    });

    expect(event.request?.url).toBe("https://example.test/customer/[redacted]");
    expect(event.contexts?.nextjs?.request_path).toBe("/customer/[redacted]");
    expect(transaction.transaction).toBe("GET /customer/[redacted]");
    expect(transaction.request?.url).toBe("https://example.test/customer/[redacted]");
    expect(breadcrumb.data).toEqual({
      from: "/customer/[redacted]",
      to: "/customer/[redacted]",
    });
    expect(span.description).toBe("GET https://example.test/customer/[redacted]");

    const serialized = JSON.stringify({ event, transaction, breadcrumb, span });
    expect(serialized).not.toContain(privateSegment);
    expect(serialized).not.toContain(decoded);
    expect(serialized).not.toContain("source=private");
    expect(serialized).not.toContain("#fragment");
  });
});
