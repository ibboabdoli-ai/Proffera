import { describe, expect, it } from "vitest";
import { getMariaPreviewPortalBase, isMariaPreviewTestRecipient, mariaPreviewStatusChangePreflight } from "./maria-preview-customer-safety";

describe("Maria Preview customer-only delivery gate", () => {
  const preview = {
    NODE_ENV: "test",
    VERCEL_ENV: "preview",
    VERCEL_URL: "proffera-jhap-qa.vercel.app",
    PROFFERA_MARIA_PREVIEW_TEST_EMAIL: "qa@example.invalid",
    PROFFERA_PREVIEW_EMAIL_RECIPIENT: "qa@example.invalid",
  } as NodeJS.ProcessEnv;

  it("only permits the approved QA recipient in Preview", () => {
    expect(isMariaPreviewTestRecipient("QA@example.invalid", preview)).toBe(true);
    expect(isMariaPreviewTestRecipient("customer@example.com", preview)).toBe(false);
    expect(isMariaPreviewTestRecipient("qa@example.invalid", { ...preview, VERCEL_ENV: "production" })).toBe(false);
    expect(isMariaPreviewTestRecipient("qa@example.invalid", { ...preview, PROFFERA_MARIA_PREVIEW_TEST_EMAIL: "" })).toBe(false);
  });

  it("rejects a different, missing or malformed effective Brevo Preview inbox", () => {
    expect(isMariaPreviewTestRecipient("qa@example.invalid", {
      ...preview, PROFFERA_PREVIEW_EMAIL_RECIPIENT: "other@example.invalid",
    })).toBe(false);
    expect(isMariaPreviewTestRecipient("qa@example.invalid", {
      ...preview, PROFFERA_PREVIEW_EMAIL_RECIPIENT: "",
    })).toBe(false);
    expect(isMariaPreviewTestRecipient("qa@example.invalid", {
      ...preview, PROFFERA_PREVIEW_EMAIL_RECIPIENT: "not-an-email",
    })).toBe(false);
    expect(isMariaPreviewTestRecipient(" QA@example.invalid ", {
      ...preview, PROFFERA_PREVIEW_EMAIL_RECIPIENT: " QA@EXAMPLE.INVALID ",
    })).toBe(true);
  });

  it("builds Preview-only portal links and refuses arbitrary hosts", () => {
    expect(getMariaPreviewPortalBase(preview)).toBe("https://proffera-jhap-qa.vercel.app");
    expect(getMariaPreviewPortalBase({ ...preview, VERCEL_ENV: "production" })).toBeNull();
    expect(getMariaPreviewPortalBase({ ...preview, VERCEL_URL: "www.proffera.se" })).toBeNull();
    expect(getMariaPreviewPortalBase({ ...preview, VERCEL_URL: "foo.vercel.app.attacker.net" })).toBeNull();
  });
});

describe("Maria Preview status-change recipient preflight", () => {
  const preview = {
    NODE_ENV: "test",
    VERCEL_ENV: "preview",
    VERCEL_URL: "proffera-jhap-qa.vercel.app",
    PROFFERA_MARIA_PREVIEW_TEST_EMAIL: "qa@example.invalid",
    PROFFERA_PREVIEW_EMAIL_RECIPIENT: "qa@example.invalid",
  } as NodeJS.ProcessEnv;

  it.each(["requested", "confirmed", "completed", "cancelled"] as const)(
    "reports the QA recipient error for missing or unapproved customer email on %s",
    (status) => {
      expect(mariaPreviewStatusChangePreflight(status, null, true, preview)).toBe("maria_preview");
      expect(mariaPreviewStatusChangePreflight(status, "", true, preview)).toBe("maria_preview");
      expect(mariaPreviewStatusChangePreflight(status, "real-customer@example.com", true, preview)).toBe("maria_preview");
      expect(mariaPreviewStatusChangePreflight(status, "qa@example.invalid", true, {
        ...preview, VERCEL_ENV: "production",
      })).toBe("maria_preview");
      expect(mariaPreviewStatusChangePreflight(status, "qa@example.invalid", true, preview)).toBeNull();
    },
  );

  it.each(["confirmed", "cancelled"] as const)(
    "requires email setup before the email-sending %s transition",
    (status) => {
      expect(mariaPreviewStatusChangePreflight(status, "qa@example.invalid", false, preview))
        .toBe("maria_email_setup");
    },
  );

  it.each(["requested", "completed"] as const)(
    "does not require email setup for the non-email %s transition",
    (status) => {
      expect(mariaPreviewStatusChangePreflight(status, "qa@example.invalid", false, preview)).toBeNull();
    },
  );
});
