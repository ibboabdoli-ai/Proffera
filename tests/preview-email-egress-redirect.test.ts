import { describe, expect, it } from "vitest";

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
});
