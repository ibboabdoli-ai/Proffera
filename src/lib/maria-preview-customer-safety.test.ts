import { describe, expect, it } from "vitest";
import { getMariaPreviewPortalBase, isMariaPreviewTestRecipient } from "./maria-preview-customer-safety";

describe("Maria Preview customer-only delivery gate", () => {
  const preview = {
    VERCEL_ENV: "preview",
    VERCEL_URL: "proffera-jhap-qa.vercel.app",
    PROFFERA_MARIA_PREVIEW_TEST_EMAIL: "qa@example.invalid",
  } as NodeJS.ProcessEnv;

  it("only permits the approved QA recipient in Preview", () => {
    expect(isMariaPreviewTestRecipient("QA@example.invalid", preview)).toBe(true);
    expect(isMariaPreviewTestRecipient("customer@example.com", preview)).toBe(false);
    expect(isMariaPreviewTestRecipient("qa@example.invalid", { ...preview, VERCEL_ENV: "production" })).toBe(false);
    expect(isMariaPreviewTestRecipient("qa@example.invalid", { ...preview, PROFFERA_MARIA_PREVIEW_TEST_EMAIL: "" })).toBe(false);
  });

  it("builds Preview-only portal links and refuses arbitrary hosts", () => {
    expect(getMariaPreviewPortalBase(preview)).toBe("https://proffera-jhap-qa.vercel.app");
    expect(getMariaPreviewPortalBase({ ...preview, VERCEL_ENV: "production" })).toBeNull();
    expect(getMariaPreviewPortalBase({ ...preview, VERCEL_URL: "www.proffera.se" })).toBeNull();
    expect(getMariaPreviewPortalBase({ ...preview, VERCEL_URL: "foo.vercel.app.attacker.net" })).toBeNull();
  });
});
