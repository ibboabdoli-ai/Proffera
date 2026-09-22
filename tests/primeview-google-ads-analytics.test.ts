import { describe, expect, it } from "vitest";

import {
  PRIMEVIEW_GOOGLE_ADS_SCRIPT_ID,
  PRIMEVIEW_GOOGLE_ADS_TAG_ID,
  buildPrimeViewGoogleAdsPageView,
  isPrimeViewBookingConversionPage,
} from "../src/lib/analytics/google-ads";
import {
  createPrimeViewGoogleAdsRuntime,
  type GoogleTagFunction,
} from "../src/lib/analytics/primeview-google-ads-runtime";
import { publicBookingSuccessRedirect } from "../src/lib/public-booking-success-redirect";
import { isPrimeViewHost } from "../src/lib/public-site-domains";

type ScriptRecord = { id: string; async: boolean; src: string };

function createRuntimeHarness(existingGoogleTag = false) {
  const commands: unknown[][] = [];
  const scripts: ScriptRecord[] = [];
  const runtime = createPrimeViewGoogleAdsRuntime();
  const gtag: GoogleTagFunction = (...args) => commands.push(args);

  function sync({
    consent,
    host = "www.primeviewwindowcare.co.uk",
    origin = "https://www.primeviewwindowcare.co.uk",
    pathname = "/booking",
    query = "",
  }: {
    consent: "unknown" | "denied" | "granted";
    host?: string;
    origin?: string;
    pathname?: string;
    query?: string;
  }) {
    runtime.sync({
      consent,
      host,
      origin,
      pathname,
      searchParams: new URLSearchParams(query),
      gtag,
      hasScriptById: (id) => scripts.some((script) => script.id === id),
      hasAnyGoogleTagScript: () =>
        existingGoogleTag
        || scripts.some((script) => script.src.startsWith("https://www.googletagmanager.com/gtag/js")),
      appendScript: (script) => scripts.push(script),
    });
  }

  return { commands, scripts, sync };
}

function pageViewCommands(commands: unknown[][]) {
  return commands.filter(
    (command) => command[0] === "event" && command[1] === "page_view",
  );
}

describe("PrimeView Google Ads conversion measurement", () => {
  it("keeps normal booking visits distinct from the booked=1 success URL", () => {
    const normalParams = new URLSearchParams("");
    const successParams = new URLSearchParams("booked=1");

    expect(isPrimeViewBookingConversionPage("/booking", normalParams)).toBe(false);
    expect(isPrimeViewBookingConversionPage("/booking", successParams)).toBe(true);

    expect(
      buildPrimeViewGoogleAdsPageView(
        "https://www.primeviewwindowcare.co.uk",
        "/booking",
        normalParams,
      ),
    ).toEqual({
      pageLocation: "https://www.primeviewwindowcare.co.uk/booking",
      pagePath: "/booking",
      isBookingConversion: false,
    });

    expect(
      buildPrimeViewGoogleAdsPageView(
        "https://www.primeviewwindowcare.co.uk",
        "/booking",
        successParams,
      ),
    ).toEqual({
      pageLocation: "https://www.primeviewwindowcare.co.uk/booking?booked=1",
      pagePath: "/booking?booked=1",
      isBookingConversion: true,
    });
  });

  it("strips arbitrary query data and sensitive path identifiers", () => {
    const successWithPii = buildPrimeViewGoogleAdsPageView(
      "https://www.primeviewwindowcare.co.uk",
      "/booking",
      new URLSearchParams("booked=1&email=person%40example.com&phone=07123456789"),
    );
    expect(successWithPii?.pageLocation).toBe(
      "https://www.primeviewwindowcare.co.uk/booking?booked=1",
    );
    expect(JSON.stringify(successWithPii)).not.toContain("person@example.com");
    expect(JSON.stringify(successWithPii)).not.toContain("07123456789");

    const verification = buildPrimeViewGoogleAdsPageView(
      "https://www.primeviewwindowcare.co.uk",
      "/boka/verifiera/550e8400-e29b-41d4-a716-446655440000",
      new URLSearchParams("code=123456"),
    );
    expect(verification?.pageLocation).toBe(
      "https://www.primeviewwindowcare.co.uk/boka/verifiera/:redacted",
    );
    expect(JSON.stringify(verification)).not.toContain("550e8400-e29b-41d4-a716-446655440000");
    expect(JSON.stringify(verification)).not.toContain("123456");
  });

  it("scopes Ads measurement to PrimeView hosts even if the runtime is invoked elsewhere", () => {
    expect(isPrimeViewHost("primeviewwindowcare.co.uk")).toBe(true);
    expect(isPrimeViewHost("www.primeviewwindowcare.co.uk")).toBe(true);
    expect(isPrimeViewHost("proffera.se")).toBe(false);
    expect(isPrimeViewHost("customer.example.com")).toBe(false);

    const harness = createRuntimeHarness();
    harness.sync({ consent: "granted", host: "proffera.se" });
    harness.sync({ consent: "granted", host: "customer.example.com" });

    expect(harness.commands).toEqual([]);
    expect(harness.scripts).toEqual([]);
  });

  it("does not load Google before consent, then loads once and sends sanitized deduplicated page views", () => {
    const harness = createRuntimeHarness();

    harness.sync({
      consent: "unknown",
      pathname: "/booking",
      query: "email=person%40example.com",
    });

    expect(PRIMEVIEW_GOOGLE_ADS_TAG_ID).toBe("AW-18438705476");
    expect(harness.scripts).toHaveLength(0);
    expect(pageViewCommands(harness.commands)).toHaveLength(0);
    expect(harness.commands[0]).toEqual([
      "consent",
      "default",
      {
        ad_storage: "denied",
        analytics_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        wait_for_update: 500,
      },
    ]);

    harness.sync({
      consent: "granted",
      pathname: "/booking",
      query: "email=person%40example.com&phone=07123456789",
    });

    expect(harness.scripts).toEqual([
      {
        id: PRIMEVIEW_GOOGLE_ADS_SCRIPT_ID,
        async: true,
        src: `https://www.googletagmanager.com/gtag/js?id=${PRIMEVIEW_GOOGLE_ADS_TAG_ID}`,
      },
    ]);

    const config = harness.commands.find((command) => command[0] === "config");
    expect(config).toEqual([
      "config",
      PRIMEVIEW_GOOGLE_ADS_TAG_ID,
      {
        send_page_view: false,
        allow_ad_personalization_signals: false,
      },
    ]);

    const grantedUpdate = harness.commands.find(
      (command) => command[0] === "consent" && command[1] === "update" &&
        (command[2] as { ad_storage?: string }).ad_storage === "granted",
    );
    expect(grantedUpdate).toEqual([
      "consent",
      "update",
      {
        ad_storage: "granted",
        analytics_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "denied",
      },
    ]);

    expect(pageViewCommands(harness.commands)).toEqual([
      [
        "event",
        "page_view",
        {
          send_to: PRIMEVIEW_GOOGLE_ADS_TAG_ID,
          page_location: "https://www.primeviewwindowcare.co.uk/booking",
          page_path: "/booking",
          page_referrer: "",
        },
      ],
    ]);
    expect(JSON.stringify(harness.commands)).not.toContain("person@example.com");
    expect(JSON.stringify(harness.commands)).not.toContain("07123456789");

    harness.sync({
      consent: "granted",
      pathname: "/booking",
      query: "email=other%40example.com",
    });
    expect(harness.scripts).toHaveLength(1);
    expect(pageViewCommands(harness.commands)).toHaveLength(1);

    harness.sync({
      consent: "granted",
      pathname: "/booking",
      query: "booked=1&email=private%40example.com&phone=07999999999",
    });

    expect(harness.scripts).toHaveLength(1);
    expect(pageViewCommands(harness.commands)).toHaveLength(2);
    expect(pageViewCommands(harness.commands)[1]).toEqual([
      "event",
      "page_view",
      {
        send_to: PRIMEVIEW_GOOGLE_ADS_TAG_ID,
        page_location: "https://www.primeviewwindowcare.co.uk/booking?booked=1",
        page_path: "/booking?booked=1",
        page_referrer: "",
      },
    ]);
    expect(harness.commands.some((command) => command[0] === "event" && command[1] === "conversion")).toBe(false);
    expect(JSON.stringify(harness.commands)).not.toContain("private@example.com");
    expect(JSON.stringify(harness.commands)).not.toContain("07999999999");
  });

  it("updates consent to denied without loading a tag and reuses an existing gtag.js instance", () => {
    const deniedHarness = createRuntimeHarness();
    deniedHarness.sync({ consent: "denied" });

    expect(deniedHarness.scripts).toHaveLength(0);
    expect(deniedHarness.commands).toContainEqual([
      "consent",
      "update",
      {
        ad_storage: "denied",
        analytics_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      },
    ]);

    const existingTagHarness = createRuntimeHarness(true);
    existingTagHarness.sync({ consent: "granted" });
    existingTagHarness.sync({ consent: "granted" });

    expect(existingTagHarness.scripts).toHaveLength(0);
    expect(pageViewCommands(existingTagHarness.commands)).toHaveLength(1);
  });

  it("routes a verified PrimeView booking to the Ads success URL", () => {
    expect(publicBookingSuccessRedirect("primeview", "sv")).toBe("/booking?booked=1");
    expect(publicBookingSuccessRedirect("primeview", "en")).toBe("/booking?booked=1");
    expect(publicBookingSuccessRedirect("example-company", "sv")).toBe(
      "/boka/example-company?booked=1&lang=sv",
    );
    expect(publicBookingSuccessRedirect("example-company", "en")).toBe(
      "/boka/example-company?booked=1&lang=en",
    );
  });
});
