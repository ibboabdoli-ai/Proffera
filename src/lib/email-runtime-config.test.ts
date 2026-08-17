import { describe, expect, it } from "vitest";

import { resolveBrevoApiKey, resolveEmailRecipient } from "@/lib/email-runtime-config";

describe("email runtime configuration", () => {
  it("fails closed in Preview instead of using the Production Brevo key", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      VERCEL_ENV: "preview",
      BREVO_API_KEY: "production-key",
    };

    expect(resolveBrevoApiKey(env)).toBeNull();
    expect(resolveEmailRecipient({ email: "customer@example.com" }, env)).toBeNull();
  });

  it("rejects a Preview key that reuses the shared Production Brevo credential", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      VERCEL_ENV: "preview",
      BREVO_API_KEY: "shared-key",
      PROFFERA_PREVIEW_BREVO_API_KEY: "shared-key",
      PROFFERA_PREVIEW_EMAIL_RECIPIENT: "preview@example.com",
    };

    expect(resolveBrevoApiKey(env)).toBeNull();
  });

  it("redirects Preview email to one explicitly configured safe recipient", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      VERCEL_ENV: "preview",
      BREVO_API_KEY: "production-key",
      PROFFERA_PREVIEW_BREVO_API_KEY: "preview-key",
      PROFFERA_PREVIEW_EMAIL_RECIPIENT: " Preview-Inbox@Example.com ",
    };

    expect(resolveBrevoApiKey(env)).toBe("preview-key");
    expect(resolveEmailRecipient({ email: "real-customer@example.com", name: "Customer" }, env)).toEqual({
      email: "preview-inbox@example.com",
      name: "Proffera Preview",
    });
  });

  it("rejects an invalid Preview recipient", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      VERCEL_ENV: "preview",
      PROFFERA_PREVIEW_EMAIL_RECIPIENT: "not-an-email",
    };

    expect(resolveEmailRecipient({ email: "customer@example.com" }, env)).toBeNull();
  });

  it("keeps Production recipient and key unchanged", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      VERCEL_ENV: "production",
      BREVO_API_KEY: "production-key",
    };
    const recipient = { email: "customer@example.com", name: "Customer" };

    expect(resolveBrevoApiKey(env)).toBe("production-key");
    expect(resolveEmailRecipient(recipient, env)).toEqual(recipient);
  });
});
