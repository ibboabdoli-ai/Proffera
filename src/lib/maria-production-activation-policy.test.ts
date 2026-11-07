import { describe, expect, it } from "vitest";

import {
  inspectMariaProductionActivationRequest,
  MARIA_CANONICAL_PRODUCTION_ORIGIN,
} from "./maria-production-activation-policy";

const ready: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  VERCEL_ENV: "production",
  PROFFERA_MARIA_PUBLIC_SITE_ENABLED: "true",
  PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED: "true",
  PROFFERA_MARIA_PRODUCTION_MANAGER_ENABLED: "true",
  PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED: "true",
  PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED: "true",
  PROFFERA_MARIA_PRODUCTION_ORIGIN: "https://makeupbymaria.se",
};

describe("Maria combined Production release request is disabled by default", () => {
  it("refuses an empty or Preview environment, even when QA booking is enabled", () => {
    const disabled = inspectMariaProductionActivationRequest({ NODE_ENV: "test" });
    expect(disabled.requested).toBe(false);
    expect(disabled.blockers).toContain("not_production");
    expect(disabled.portalOrigin).toBeNull();

    const preview = inspectMariaProductionActivationRequest({
      ...ready,
      VERCEL_ENV: "preview",
      PROFFERA_MARIA_PREVIEW_BOOKING_ENABLED: "true",
      PROFFERA_MARIA_PREVIEW_TEST_EMAIL: "qa@example.invalid",
    });
    expect(preview.requested).toBe(false);
    expect(preview.blockers).toEqual(["not_production"]);
  });

  it("requires every independent site, booking, manager, delivery, editor and origin gate", () => {
    expect(inspectMariaProductionActivationRequest(ready)).toEqual({
      requested: true,
      blockers: [],
      portalOrigin: MARIA_CANONICAL_PRODUCTION_ORIGIN,
    });
    for (const key of [
      "PROFFERA_MARIA_PUBLIC_SITE_ENABLED",
      "PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED",
      "PROFFERA_MARIA_PRODUCTION_MANAGER_ENABLED",
      "PROFFERA_MARIA_PRODUCTION_CUSTOMER_EMAIL_ENABLED",
      "PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED",
      "PROFFERA_MARIA_PRODUCTION_ORIGIN",
    ]) {
      const input = { ...ready };
      delete input[key];
      expect(inspectMariaProductionActivationRequest(input).requested).toBe(false);
    }
  });

  it("never treats truthy strings or a lookalike/untrusted portal URL as authorization", () => {
    for (const origin of [
      "http://makeupbymaria.se",
      "https://www.makeupbymaria.se",
      "https://makeupbymaria.se.attacker.invalid",
      "https://makeupbymaria.se/booking",
      "https://evil.example@makeupbymaria.se",
    ]) {
      const result = inspectMariaProductionActivationRequest({
        ...ready, PROFFERA_MARIA_PRODUCTION_ORIGIN: origin,
      });
      expect(result.requested).toBe(false);
      expect(result.blockers).toContain("canonical_origin_mismatch");
    }
    expect(inspectMariaProductionActivationRequest({
      ...ready, PROFFERA_MARIA_PRODUCTION_BOOKING_ENABLED: "1",
    }).requested).toBe(false);
  });
});
