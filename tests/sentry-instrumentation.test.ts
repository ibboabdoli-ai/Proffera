import { beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  captureRequestError: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => sentryMocks);

import { onRequestError } from "@/instrumentation";

beforeEach(() => {
  sentryMocks.captureRequestError.mockReset();
});

describe("Sentry request instrumentation", () => {
  it("adds Sentry capture without replacing structured request-error logging", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("private error body");
    const request = {
      path: "/review/private-token",
      method: "GET",
      headers: {},
    };
    const context = {
      routerKind: "App Router" as const,
      routePath: "/review/[token]",
      routeType: "render" as const,
      renderSource: "react-server-components" as const,
      revalidateReason: undefined,
      renderType: "dynamic" as const,
    };

    await onRequestError(error, request, context);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(errorSpy.mock.calls[0]?.[0]))).toMatchObject({
      event: "server_request_error",
      route: "/review/[token]",
      method: "GET",
      source: "next.onRequestError",
    });
    expect(sentryMocks.captureRequestError).toHaveBeenCalledWith(error, request, context);

    errorSpy.mockRestore();
  });
});
