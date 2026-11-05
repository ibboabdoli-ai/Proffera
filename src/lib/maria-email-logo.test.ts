import { describe, expect, it } from "vitest";
import { mariaEmailLogoHtml } from "./maria-email-logo";

describe("Maria email logo", () => {
  it("uses the approved original logo from an HTTPS Preview hostname", () => {
    const html = mariaEmailLogoHtml("https://qa.vercel.app/mina-bokningar/test?lang=sv");
    expect(html).toContain('src="https://qa.vercel.app/demo/makeup-by-maria/assets/maria-client-logo.jpg"');
    expect(html).toContain('alt="Makeup by Maria"');
    expect(html).toContain('role="presentation"');
    expect(html).toContain('width="180"');
  });

  it.each([
    "", "http://qa.vercel.app", "https://qa.vercel.app.evil.test",
    "https://evil.test", "javascript:alert(1)", "https://attacker@qa.vercel.app",
  ])("fails closed for an unsafe source: %s", (url) => {
    expect(mariaEmailLogoHtml(url)).toBe("");
  });
});
