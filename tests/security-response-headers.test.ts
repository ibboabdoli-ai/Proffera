import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  SECURITY_CSP_REPORT_ONLY,
  SECURITY_RESPONSE_HEADERS,
} from "../src/lib/security-response-headers";

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

  it("stages CSP as report-only without restricting existing HTTPS integrations", () => {
    const headers = headerMap();

    expect(headers["Content-Security-Policy"]).toBeUndefined();
    expect(headers["Content-Security-Policy-Report-Only"]).toBe(SECURITY_CSP_REPORT_ONLY);
    expect(SECURITY_CSP_REPORT_ONLY).toContain("default-src 'self' https: data: blob:");
    expect(SECURITY_CSP_REPORT_ONLY).toContain("object-src 'none'");
    expect(SECURITY_CSP_REPORT_ONLY).toContain("base-uri 'self'");
    expect(SECURITY_CSP_REPORT_ONLY).toContain("frame-ancestors 'self'");
    expect(SECURITY_CSP_REPORT_ONLY).toContain("form-action 'self' https:");
    expect(SECURITY_CSP_REPORT_ONLY).toContain("connect-src 'self' https: wss:");
    expect(SECURITY_CSP_REPORT_ONLY).toContain("frame-src 'self' https:");
  });

  it("wires the shared contract globally through Next config", () => {
    const config = readFileSync(resolve(process.cwd(), "next.config.ts"), "utf8");

    expect(config).toContain('source: "/:path*"');
    expect(config).toContain("SECURITY_RESPONSE_HEADERS.map");
  });
});
