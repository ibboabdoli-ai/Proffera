import { describe, expect, it } from "vitest";

import { hostnameFromHostHeader, isPrimeViewHost } from "./public-site-domains";

describe("public site domains", () => {
  it("normalizes host headers before matching the PrimeView domain", () => {
    expect(hostnameFromHostHeader("PRIMEVIEWWINDOWCARE.CO.UK:443")).toBe("primeviewwindowcare.co.uk");
    expect(isPrimeViewHost("www.primeviewwindowcare.co.uk")).toBe(true);
  });

  it("does not classify Proffera or unknown domains as PrimeView", () => {
    expect(isPrimeViewHost("www.proffera.se")).toBe(false);
    expect(isPrimeViewHost("example.com")).toBe(false);
  });
});
