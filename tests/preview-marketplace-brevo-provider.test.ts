import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { inspectPreviewMarketplaceBrevoTransaction } from "@/lib/preview-marketplace-brevo-provider";

const branch = "work/proffera-marketplace-browser-lifecycle-e2e";
const messageId = "<preview-review-message@relay.example>";

function previewEnv() {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_GIT_COMMIT_REF", branch);
  vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "preview-key");
  vi.stubEnv("BREVO_API_KEY", "");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Preview Marketplace Brevo provider transaction probe", () => {
  it("reads exact message-id events and reports delivered without exposing recipient data", async () => {
    previewEnv();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      events: [
        { event: "request", messageId },
        { event: "delivered", messageId },
      ],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(inspectPreviewMarketplaceBrevoTransaction(messageId)).resolves.toEqual({
      status: "delivered",
      events: ["request", "delivered"],
      reason: null,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/v3/smtp/statistics/events");
    expect(url.searchParams.get("messageId")).toBe(messageId);
    expect(url.searchParams.get("days")).toBe("1");
  });

  it("reports a blocked provider result and redacts email-like text from the reason", async () => {
    previewEnv();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      events: [{
        event: "blocked",
        messageId,
        reason: "Recipient private@example.com is blocked",
      }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await inspectPreviewMarketplaceBrevoTransaction(messageId);
    expect(result).toEqual({
      status: "blocked",
      events: ["blocked"],
      reason: "Recipient [redacted-email] is blocked",
    });
    expect(JSON.stringify(result)).not.toContain("private@example.com");
  });

  it("fails closed outside the exact Marketplace Preview E2E runtime", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("PROFFERA_PREVIEW_BREVO_API_KEY", "preview-key");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(inspectPreviewMarketplaceBrevoTransaction(messageId)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
