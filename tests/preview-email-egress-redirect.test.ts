import { createServer, type Server } from "node:http";

import { afterEach, describe, expect, it, vi } from "vitest";

import { register } from "@/instrumentation";
import { buildPreviewSafeBrevoRequestInit } from "@/lib/preview-email-egress";
import { PREVIEW_MARKETPLACE_E2E_BRANCH } from "@/lib/preview-marketplace-e2e-constants";

const APPROVED_READER_URLS = [
  "https://api.brevo.com/v3/smtp/emails?email=preview-inbox%40example.com&startDate=2026-09-03&endDate=2026-09-03&sort=desc&limit=20",
  "https://api.brevo.com/v3/smtp/emails?messageId=%3C20260903.123456%40smtp-relay.mailin.fr%3E",
  "https://api.brevo.com/v3/smtp/statistics/events?email=preview-inbox%40example.com&event=delivered&days=1&sort=desc&limit=50",
  "https://api.brevo.com/v3/smtp/statistics/events?messageId=%3C20260903.123456%40smtp-relay.mailin.fr%3E&days=1&limit=50&sort=desc",
  "https://api.brevo.com/v3/smtp/emails/123e4567-e89b-12d3-a456-426614174000",
] as const;

const env: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: PREVIEW_MARKETPLACE_E2E_BRANCH,
  BREVO_API_KEY: "production-key",
  PROFFERA_PREVIEW_BREVO_API_KEY: "preview-key",
  PROFFERA_PREVIEW_EMAIL_RECIPIENT: "preview-inbox@example.com",
};

function listen(server: Server) {
  return new Promise<number>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Test server did not expose a TCP port."));
        return;
      }
      resolve(address.port);
    });
  });
}

function close(server: Server) {
  return new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Preview Brevo reader redirect safety", () => {
  it.each(APPROVED_READER_URLS)("forces redirect rejection for approved reader %s", (url) => {
    const result = buildPreviewSafeBrevoRequestInit(url, {
      method: "GET",
      headers: { "api-key": "wrong-key" },
      redirect: "follow",
    }, env);

    expect(result?.method).toBe("GET");
    expect(result?.redirect).toBe("error");
    const headers = new Headers(result?.headers);
    expect(headers.get("api-key")).toBe("preview-key");
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("rejects a redirect at the registered fetch boundary before the target is contacted", async () => {
    let targetHits = 0;
    const target = createServer((_request, response) => {
      targetHits += 1;
      response.statusCode = 200;
      response.end("unexpected target request");
    });
    const targetPort = await listen(target);

    const redirector = createServer((_request, response) => {
      response.statusCode = 302;
      response.setHeader("location", `http://127.0.0.1:${targetPort}/redirect-target`);
      response.end();
    });
    const redirectorPort = await listen(redirector);

    const nativeFetch = globalThis.fetch.bind(globalThis);
    const boundaryFetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => (
      nativeFetch(`http://127.0.0.1:${redirectorPort}/reader`, init)
    ));

    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", PREVIEW_MARKETPLACE_E2E_BRANCH);
    vi.stubEnv("BREVO_API_KEY", "production-key");
    vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "preview-key");
    vi.stubEnv("PROFFERA_PREVIEW_EMAIL_RECIPIENT", "preview-inbox@example.com");
    vi.stubGlobal("fetch", boundaryFetch);

    try {
      await register();
      await expect(globalThis.fetch(APPROVED_READER_URLS[0], {
        method: "GET",
        headers: { "api-key": "wrong-key" },
        redirect: "follow",
      })).rejects.toThrow();

      expect(boundaryFetch).toHaveBeenCalledTimes(1);
      expect(boundaryFetch.mock.calls[0]?.[1]?.redirect).toBe("error");
      expect(targetHits).toBe(0);
    } finally {
      await close(redirector);
      await close(target);
    }
  });
});
