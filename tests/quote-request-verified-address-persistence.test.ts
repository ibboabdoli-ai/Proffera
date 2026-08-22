import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import { storeQuoteRequest } from "@/features/quote-request/persistence";
import { initialQuoteRequest } from "@/features/quote-request/schema";

const input = {
  ...initialQuoteRequest,
  category: "Elektriker",
  serviceType: "Felsökning el",
  addressLine1: "Storgatan 12",
  locationSource: "address" as const,
  latitude: null,
  longitude: null,
  city: "Södertälje",
  postalCode: "151 46",
  description: "Jag behöver hjälp med felsökning av el i bostaden.",
  preferredDate: "Inom en vecka",
  contactName: "Test Customer",
  contactEmail: "customer@example.com",
  contactPhone: "0700000000",
  consentAccepted: true,
};

const verified = {
  status: "matched" as const,
  source: "lantmateriet_belagenhetsadress_v4_2" as const,
  referenceId: "439b33bf-6279-4b65-b32c-9741646d8d3e",
  easting: 674000,
  northing: 6580000,
};

function createSql(storageReady: boolean) {
  const calls: Array<{ query: string; values: unknown[] }> = [];
  const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const query = strings.join("?");
    calls.push({ query, values });
    if (query.includes("select reference_id")) return [];
    if (query.includes("information_schema.columns")) return [{ ready: storageReady }];
    if (query.includes("st_y(transformed.point)")) {
      return [{ latitude: 59.32287321764047, longitude: 18.05796533678305 }];
    }
    return [];
  });
  return { sql, calls };
}

describe("verified customer address persistence", () => {
  beforeEach(() => {
    mocks.getSql.mockReset();
    vi.restoreAllMocks();
  });

  it("stores transformed verified coordinates and provenance without repurposing browser geolocation fields", async () => {
    const { sql, calls } = createSql(true);
    mocks.getSql.mockReturnValue(sql);

    const result = await storeQuoteRequest(input, verified);

    expect(result.ok).toBe(true);
    const transform = calls.find((call) => call.query.includes("st_y(transformed.point)"));
    expect(transform?.values).toEqual([674000, 6580000]);

    const insert = calls.find((call) => (
      call.query.includes("insert into quote_requests")
      && call.query.includes("customer_verified_latitude")
    ));
    expect(insert).toBeDefined();
    expect(insert?.query).toContain("customer_verified_latitude,\n          customer_verified_longitude");
    expect(insert?.values).toContain("Storgatan 12");
    expect(insert?.values.slice(8, 10)).toEqual([
      59.32287321764047,
      18.05796533678305,
    ]);
    expect(insert?.values).toContain("lantmateriet_belagenhetsadress_v4_2");
    expect(insert?.values).toContain("439b33bf-6279-4b65-b32c-9741646d8d3e");
  });

  it("keeps the legacy address insert deploy-safe until migration 0059 exists", async () => {
    const { sql, calls } = createSql(false);
    mocks.getSql.mockReturnValue(sql);

    const result = await storeQuoteRequest(input, verified);

    expect(result.ok).toBe(true);
    expect(calls.some((call) => call.query.includes("st_makepoint"))).toBe(false);
    const insert = calls.find((call) => call.query.includes("insert into quote_requests"));
    expect(insert?.query).not.toContain("customer_verified_latitude");
    expect(insert?.values).toContain("Storgatan 12");
  });

  it("fails before verified storage when the official reference is not a UUID", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { sql, calls } = createSql(true);
    mocks.getSql.mockReturnValue(sql);

    const result = await storeQuoteRequest(input, {
      ...verified,
      referenceId: "not-a-uuid",
    });

    expect(result.ok).toBe(false);
    expect(calls.some((call) => call.query.includes("information_schema.columns"))).toBe(false);
    expect(calls.some((call) => call.query.includes("st_makepoint"))).toBe(false);
    expect(calls.some((call) => (
      call.query.includes("insert into quote_requests")
      && call.query.includes("customer_verified_latitude")
    ))).toBe(false);
  });
});
