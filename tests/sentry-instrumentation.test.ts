import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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


describe("Sentry browser environment labeling", () => {
  it("maps the Vercel deployment environment into the browser SDK at build time", () => {
    const nextConfig = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");
    const clientInstrumentation = readFileSync(
      resolve(process.cwd(), "src/instrumentation-client.ts"),
      "utf8",
    );

    expect(nextConfig).toContain(
      'const sentryEnvironment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";',
    );
    expect(nextConfig).toContain("NEXT_PUBLIC_SENTRY_ENVIRONMENT: sentryEnvironment");
    expect(clientInstrumentation).toContain(
      "environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV",
    );
    expect(clientInstrumentation).not.toContain("NEXT_PUBLIC_VERCEL_ENV");
  });
});
