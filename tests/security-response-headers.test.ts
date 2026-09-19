import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { SECURITY_RESPONSE_HEADERS } from "../src/lib/security-response-headers";

function headerMap() {
  return Object.fromEntries(SECURITY_RESPONSE_HEADERS.map(({ key, value }) => [key, value]));
}

describe("security response headers", () => {
  it("enforces bounded browser hardening headers", () => {
    expect(headerMap()).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "SAMEORIGIN",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)",
    });
  });

  it("does not emit CSP until report-only violations have an observable privacy-safe destination", () => {
    const headers = headerMap();

    expect(headers["Content-Security-Policy"]).toBeUndefined();
    expect(headers["Content-Security-Policy-Report-Only"]).toBeUndefined();
  });

  it("wires the shared contract globally through Next config", () => {
    const config = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");

    expect(config).toContain('source: "/:path*"');
    expect(config).toContain("SECURITY_RESPONSE_HEADERS.map");
  });
});
