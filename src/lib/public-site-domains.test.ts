import { describe, expect, it } from "vitest";

import { hostnameFromHostHeader, isMariaHost, isPrimeViewHost, isPublicPageRouteAllowedForHost } from "./public-site-domains";

describe("public site domains", () => {
  it("normalizes host headers before matching the PrimeView domain", () => {
    expect(hostnameFromHostHeader("PRIMEVIEWWINDOWCARE.CO.UK:443")).toBe("primeviewwindowcare.co.uk");
    expect(isPrimeViewHost("www.primeviewwindowcare.co.uk")).toBe(true);
  });

  it("does not classify Proffera or unknown domains as PrimeView", () => {
    expect(isPrimeViewHost("www.proffera.se")).toBe(false);
    expect(isPrimeViewHost("example.com")).toBe(false);
  });
  it("reserves only Maria's exact host and blocks unrelated app routes", () => {
    expect(isMariaHost("MAKEUPBYMARIA.SE:443")).toBe(true);
    expect(isMariaHost("www.makeupbymaria.se")).toBe(true);
    expect(isMariaHost("makeupbymaria.se.attacker.invalid")).toBe(false);
    for (const host of ["makeupbymaria.se", "www.makeupbymaria.se"]) {
      for (const path of ["/", "/boka/makeup-by-maria", "/boka/verifiera/test", "/mina-bokningar/test", "/maria/swish/test"]) {
        expect(isPublicPageRouteAllowedForHost(host, path)).toBe(true);
      }
      for (const path of ["/dashboard", "/admin", "/boka/other", "/boka/primeview", "/booking", "/offert", "/tjanster"]) {
        expect(isPublicPageRouteAllowedForHost(host, path)).toBe(false);
      }
    }
  });
});
