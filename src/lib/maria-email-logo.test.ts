import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mariaEmailLogoHtml } from "./maria-email-logo";

describe("Maria email logo", () => {
  beforeEach(() => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "qa.vercel.app");
  });
  afterEach(() => vi.unstubAllEnvs());
  it("uses the approved original logo from an HTTPS Preview hostname", () => {
    const html = mariaEmailLogoHtml("https://qa.vercel.app/mina-bokningar/test?lang=sv");
    expect(html).toContain('src="https://qa.vercel.app/demo/makeup-by-maria/assets/maria-client-logo.jpg"');
    expect(html).toContain('alt="Makeup by Maria"');
    expect(html).toContain('role="presentation"');
    expect(html).toContain('width="180"');
  });

  it.each([
    "", "http://qa.vercel.app", "https://qa.vercel.app.evil.test",
    "https://evil.test", "https://evil.vercel.app", "javascript:alert(1)", "https://attacker@qa.vercel.app",
  ])("fails closed for an unsafe source: %s", (url) => {
    expect(mariaEmailLogoHtml(url)).toBe("");
  });

  it("never uses an arbitrary origin when Preview is disabled", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(mariaEmailLogoHtml("https://qa.vercel.app")).toBe("");
  });
});
