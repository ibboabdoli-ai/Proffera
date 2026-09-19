import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as reportClientError } from "@/app/api/observability/client-error/route";
import GlobalError, { resolveGlobalErrorPresentation } from "@/app/global-error";
import {
  captureServerRequestError,
  requestIdFromHeaders,
} from "@/lib/observability/server";
import {
  scrubSentryBreadcrumb,
  scrubSentryEvent,
  scrubSentrySpan,
} from "@/lib/observability/sentry-privacy";

const requestId = "123e4567-e89b-42d3-a456-426614174000";
const endpoint = "https://proffera.se/api/observability/client-error";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("observability foundation", () => {
  it("rejects cross-origin client error reports before logging", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await reportClientError(new Request(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "sec-fetch-site": "cross-site",
        origin: "https://attacker.example",
      },
      body: JSON.stringify({ name: "Error", routeGroup: "other" }),
    }));

    expect(response.status).toBe(403);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("stops reading an oversized streamed body and returns 413", async () => {
    let pulls = 0;
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        controller.enqueue(new Uint8Array(1_024));
        if (pulls >= 10) controller.close();
      },
      cancel() {
        cancelled = true;
      },
    });

    const response = await reportClientError(new Request(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "sec-fetch-site": "same-origin",
      },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" }));

    expect(response.status).toBe(413);
    expect(cancelled).toBe(true);
    expect(pulls).toBeLessThan(10);
  });

  it("logs only bounded sanitized client error fields", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const response = await reportClientError(new Request(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "sec-fetch-site": "same-origin",
        "x-proffera-request-id": requestId,
      },
      body: JSON.stringify({
        name: "TypeError",
        digest: "digest_123",
        routeGroup: "booking",
        message: "private customer token SECRET-123",
        stack: "private stack SECRET-456",
      }),
    }));

    expect(response.status).toBe(204);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    const serialized = String(errorSpy.mock.calls[0]?.[0] ?? "");
    const event = JSON.parse(serialized) as Record<string, unknown>;
    expect(event).toMatchObject({
      event: "client_global_error",
      level: "error",
      requestId,
      errorName: "TypeError",
      digest: "digest_123",
      routeGroup: "booking",
      route: "/api/observability/client-error",
    });
    expect(event).not.toHaveProperty("message");
    expect(event).not.toHaveProperty("stack");
    expect(serialized).not.toContain("SECRET-123");
    expect(serialized).not.toContain("SECRET-456");
  });

  it("uses the framework route template instead of tokenized raw request paths", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    captureServerRequestError(
      Object.assign(new Error("private failure SECRET-789"), { digest: "server_digest" }),
      {
        path: "/review/private-token-123?email=private@example.com",
        method: "GET",
        headers: { "x-proffera-request-id": requestId },
      },
      {
        routePath: "/app/review/[token]",
        routeType: "render",
      },
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const serialized = String(errorSpy.mock.calls[0]?.[0] ?? "");
    const event = JSON.parse(serialized) as Record<string, unknown>;
    expect(event).toMatchObject({
      event: "server_request_error",
      requestId,
      route: "/app/review/[token]",
      method: "GET",
      errorName: "Error",
      digest: "server_digest",
    });
    expect(serialized).not.toContain("private-token-123");
    expect(serialized).not.toContain("private@example.com");
    expect(serialized).not.toContain("SECRET-789");
  });

  it("preserves request IDs from record headers case-insensitively", () => {
    const preserved = requestIdFromHeaders({
      "X-Proffera-Request-Id": requestId,
    });

    expect(preserved).toBe(requestId);
  });

  it("generates a UUID when an incoming correlation value is invalid", () => {
    const generated = requestIdFromHeaders(new Headers({
      "x-proffera-request-id": "not-a-valid-request-id",
    }));

    expect(generated).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
  });

  it("resolves public and customer-domain error locales without trusting rewrite source paths", () => {
    expect(resolveGlobalErrorPresentation("/en/problem", "www.proffera.se")).toEqual({
      locale: "en",
      documentLanguage: "en",
    });
    expect(resolveGlobalErrorPresentation("/problem", "www.proffera.se")).toEqual({
      locale: "sv",
      documentLanguage: "sv",
    });
    expect(resolveGlobalErrorPresentation("/booking", "www.primeviewwindowcare.co.uk")).toEqual({
      locale: "en",
      documentLanguage: "en-GB",
    });
  });

  it("uses a stable Swedish server fallback before browser pathname/host hydration", () => {
    const markup = renderToStaticMarkup(createElement(GlobalError, {
      error: new Error("boom"),
      reset: vi.fn(),
    }));

    expect(markup).toContain('lang="sv"');
    expect(markup).toContain("Något gick fel");
    expect(markup).toContain("Försök igen");
    expect(markup).not.toContain("Something went wrong");
  });

  it("removes request PII and query values before Sentry delivery", () => {
    const event = scrubSentryEvent({
      type: undefined,
      message: "customer 556677-8899 failed",
      logentry: { message: "private structured message" },
      extra: { organizationNumber: "556677-8899" },
      user: { id: "private-user", email: "private@example.com" },
      transaction: `/mina-bokningar/${"signed".repeat(8)}.${"signature".repeat(4)}?email=private@example.com`,
      request: {
        url: `https://proffera.se/review/${"a".repeat(40)}?email=private@example.com#secret`,
        cookies: { session: "private-cookie" },
        data: "private-body",
        headers: { authorization: "Bearer private-token" },
        query_string: "email=private@example.com",
      },
      exception: {
        values: [{
          type: "DirectoryError",
          value: "organization 556677-8899 failed",
          stacktrace: {
            frames: [{ filename: "company-directory.ts", vars: { organizationNumber: "556677-8899" } }],
          },
        }],
      },
    });

    expect(event.user).toBeUndefined();
    expect(event.message).toBeUndefined();
    expect(event.logentry).toBeUndefined();
    expect(event.extra).toBeUndefined();
    expect(event.transaction).toBe("/mina-bokningar/[redacted]");
    expect(event.request).toEqual({
      url: "https://proffera.se/review/[redacted]",
      cookies: undefined,
      data: undefined,
      headers: undefined,
      query_string: undefined,
    });
    expect(event.exception?.values?.[0]?.value).toBe("DirectoryError");
    expect(event.exception?.values?.[0]?.stacktrace?.frames?.[0]?.vars).toBeUndefined();
  });

  it("removes query values from Sentry HTTP breadcrumbs", () => {
    const breadcrumb = scrubSentryBreadcrumb({
      category: "fetch",
      data: {
        method: "GET",
        status_code: 200,
        url: `/api/customer/${"b".repeat(40)}?token=private-token#secret`,
      },
    });

    expect(breadcrumb.data).toEqual({
      method: "GET",
      status_code: 200,
      url: "/api/customer/[redacted]",
    });
  });

  it("scrubs navigation breadcrumb destinations and arbitrary breadcrumb payloads", () => {
    const breadcrumb = scrubSentryBreadcrumb({
      category: "navigation",
      message: "customer private@example.com navigated",
      data: {
        from: `/review/${"signed".repeat(8)}.${"signature".repeat(4)}?from=private`,
        to: `/mina-bokningar/${"d".repeat(40)}#secret`,
        customerEmail: "private@example.com",
      },
    });

    expect(breadcrumb.message).toBeUndefined();
    expect(breadcrumb.data).toEqual({
      from: "/review/[redacted]",
      to: "/mina-bokningar/[redacted]",
    });
  });

  it("removes URL attributes and sensitive path segments from Sentry spans", () => {
    const span = scrubSentrySpan({
      data: {
        "http.method": "GET",
        "http.url": `https://proffera.se/review/${"c".repeat(40)}?token=secret`,
        "url.full": "https://proffera.se/private?token=secret",
        "url.query": "token=secret",
      },
      description: `https://proffera.se/review/${"c".repeat(40)}?token=secret`,
      span_id: "1234567890abcdef",
      start_timestamp: 1,
      trace_id: "1234567890abcdef1234567890abcdef",
    });

    expect(span.data).toEqual({ "http.method": "GET" });
    expect(span.description).toBe("https://proffera.se/review/[redacted]");
  });
});
