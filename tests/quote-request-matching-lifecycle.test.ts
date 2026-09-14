import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import { getLeadMatches } from "@/features/matching/list";
import {
  isQuoteRequestOpenForMatchingOrDelivery,
  QUOTE_REQUEST_MATCHING_DELIVERY_STATUSES,
} from "@/lib/quote-request-lifecycle";

describe("Quote Request matching and delivery lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSql.mockReset();
  });

  it("keeps one canonical set of statuses open for new matching and delivery", () => {
    expect(QUOTE_REQUEST_MATCHING_DELIVERY_STATUSES).toEqual([
      "submitted",
      "pending_review",
      "approved",
      "matched",
      "answered",
    ]);

    for (const status of QUOTE_REQUEST_MATCHING_DELIVERY_STATUSES) {
      expect(isQuoteRequestOpenForMatchingOrDelivery(status)).toBe(true);
    }
  });

  it.each(["draft", "booked", "completed", "cancelled", "rejected", "selected", "expired", ""])(
    "fails closed for a status that cannot receive new matching or delivery: %s",
    (status) => {
      expect(isQuoteRequestOpenForMatchingOrDelivery(status)).toBe(false);
    },
  );

  it("filters legacy matching to the canonical open statuses before the result limit", async () => {
    const calls: Array<{ text: string; values: unknown[] }> = [];
    const sql = vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({
        text: strings.join(" ? ").replace(/\s+/g, " ").trim(),
        values,
      });
      return [];
    });
    mocks.getSql.mockReturnValue(sql);

    const result = await getLeadMatches();

    expect(result).toEqual({ ok: true, matches: [] });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.values).toEqual([...QUOTE_REQUEST_MATCHING_DELIVERY_STATUSES]);
    expect(calls[0]?.text).toContain("from quote_requests request where request.status in (");
    expect(calls[0]?.text.indexOf("where request.status in (")).toBeLessThan(
      calls[0]?.text.indexOf("order by request.created_at desc") ?? -1,
    );
    expect(calls[0]?.text.indexOf("order by request.created_at desc")).toBeLessThan(
      calls[0]?.text.indexOf("limit 50") ?? -1,
    );
  });

  it("uses private customer coordinates for matching without returning them in LeadMatch.lead", async () => {
    let callIndex = 0;
    const sql = vi.fn(async () => {
      callIndex += 1;
      if (callIndex === 1) {
        return [{
          id: "11111111-1111-4111-8111-111111111111",
          reference_id: "QR-PRIVATE-GEO",
          category: "VVS",
          service_type: "VVS / Rörmokare",
          city: "Södertälje",
          postal_code: "151 46",
          description: "Läckande rör",
          status: "submitted",
          created_at: "2026-09-14T08:00:00.000Z",
          customer_latitude: 59.1955,
          customer_longitude: 17.6253,
        }];
      }
      return [{
        workspace_id: "22222222-2222-4222-8222-222222222222",
        company_name: "Verifierad VVS AB",
        primary_city: "Stockholm",
        email: "kontakt@verifieradvvs.se",
        phone: "0700000000",
        workspace_status: "active",
        claimed_profile_id: "33333333-3333-4333-8333-333333333333",
        claimed_profile_category_slug: "vvs",
        claimed_profile_is_active: true,
        claimed_profile_privacy_blocked: false,
        provider_city: "Stockholm",
        provider_municipality: "Stockholm",
        claim_status: "claimed",
        claim_verified_at: "2026-09-01T10:00:00.000Z",
        claim_resolved_at: "2026-09-01T10:05:00.000Z",
        service_id: "44444444-4444-4444-8444-444444444444",
        service_name: "VVS / Rörmokare",
        service_category: "VVS",
        service_area: "Stockholm",
        service_area_radius_km: 25,
        provider_latitude: 59.1955,
        provider_longitude: 17.6253,
        geocode_source: "lantmateriet_belagenhetsadress_v4_2",
        geocode_precision: "address",
        geocode_confidence: 100,
        geocoded_at: "2026-09-01T09:00:00.000Z",
        location_is_public: true,
        service_is_active: true,
        service_public_status: "published",
        service_conversion_mode: "quote",
        feature_minimum_plan: "starter",
        workspace_feature_enabled: true,
        admin_override_enabled: null,
        plan_key: "starter",
        plan_status: "active",
        plan_period_end: null,
        trial_status: null,
        trial_ends_at: null,
      }];
    });
    mocks.getSql.mockReturnValue(sql);

    const result = await getLeadMatches();

    expect(result.ok).toBe(true);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.lead).toMatchObject({ reference_id: "QR-PRIVATE-GEO" });
    expect(result.matches[0]?.suggestions).toHaveLength(1);
    expect(result.matches[0]?.suggestions[0]).toMatchObject({
      companyName: "Verifierad VVS AB",
      coverageState: "confirmed_inside",
    });
    expect(result.matches[0]?.lead).not.toHaveProperty("customer_latitude");
    expect(result.matches[0]?.lead).not.toHaveProperty("customer_longitude");
    expect(result.matches[0]?.lead).not.toHaveProperty("customerLatitude");
    expect(result.matches[0]?.lead).not.toHaveProperty("customerLongitude");
  });
});
