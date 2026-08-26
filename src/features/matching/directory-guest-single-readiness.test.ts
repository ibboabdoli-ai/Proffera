import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import { getDirectoryGuestLeadMatch } from "./directory-guest-single";

function sqlResponses(...responses: unknown[][]) {
  let index = 0;
  return vi.fn(async () => responses[index++] ?? []);
}

const leadRow = {
  id: "11111111-1111-4111-8111-111111111111",
  reference_id: "QR-READY",
  category: "VVS",
  service_type: "VVS / Rörmokare",
  city: "Södertälje",
  postal_code: "151 46",
  description: "Läckande rör",
  status: "submitted",
  customer_latitude: null,
  customer_longitude: null,
  created_at: "2026-08-23T00:00:00.000Z",
};

const workplace = {
  visitingAddress: {
    addressLine: "ERIKSHÄLLSGATAN 40",
    postalCode: "151 46",
    city: "SÖDERTÄLJE",
  },
};

const candidateRow = {
  profile_id: "22222222-2222-4222-8222-222222222222",
  public_slug: "ror-ab",
  display_name: "Rör AB",
  city: "Södertälje",
  municipality: "Södertälje",
  category_slug: "vvs",
  quality_score: 95,
  publication_status: "published",
  is_active: true,
  privacy_blocked: false,
  organization_kind: "juridical_person",
  claimed_workspace_id: null,
  advertising_blocked: false,
  service_slug: "vvs",
  service_name: "VVS / Rörmokare",
  service_category: "VVS",
  latitude: 59.1955,
  longitude: 17.6253,
  geocode_source: "lantmateriet_belagenhetsadress_v4_2",
  geocode_precision: "address",
  geocode_confidence: 100,
  geocoded_at: "2026-08-23T00:00:00.000Z",
  location_is_public: true,
  service_area_radius_km: 25,
  recipient_email: "offert@rorfirma.se",
  scb_phone: "+46 70 123 45 67",
  scb_workplaces: [workplace],
  scb_conflicts: [],
};

describe("single-request Marketplace readiness gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a candidate only when the shared readiness classifier marks it Auto Outreach Ready", async () => {
    const sql = sqlResponses([leadRow], [], [candidateRow]);
    mocks.getSql.mockReturnValue(sql);

    const result = await getDirectoryGuestLeadMatch(leadRow.id);

    expect(result.ok).toBe(true);
    expect(result.match?.candidates).toHaveLength(1);
    expect(result.match?.candidates[0]?.recipientEmail).toBe("offert@rorfirma.se");
  });

  it("blocks a candidate with SCB reklamspärr from automatic outreach", async () => {
    const sql = sqlResponses([leadRow], [], [{
      ...candidateRow,
      advertising_blocked: true,
    }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await getDirectoryGuestLeadMatch(leadRow.id);

    expect(result.ok).toBe(true);
    expect(result.match?.candidates).toEqual([]);
  });

  it("blocks automatic outreach when reklamspärr status is unknown", async () => {
    const sql = sqlResponses([leadRow], [], [{
      ...candidateRow,
      advertising_blocked: null,
    }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await getDirectoryGuestLeadMatch(leadRow.id);

    expect(result.ok).toBe(true);
    expect(result.match?.candidates).toEqual([]);
  });

  it("rejects arbitrary finite coordinates without verified Lantmäteriet provenance", async () => {
    const sql = sqlResponses([leadRow], [], [{
      ...candidateRow,
      geocode_source: "manual",
    }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await getDirectoryGuestLeadMatch(leadRow.id);

    expect(result.ok).toBe(true);
    expect(result.match?.candidates).toEqual([]);
  });

  it("rejects ambiguous multiple SCB workplaces", async () => {
    const sql = sqlResponses([leadRow], [], [{
      ...candidateRow,
      scb_workplaces: [
        workplace,
        {
          visitingAddress: {
            addressLine: "RINGVÄGEN 80",
            postalCode: "118 60",
            city: "STOCKHOLM",
          },
        },
      ],
    }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await getDirectoryGuestLeadMatch(leadRow.id);

    expect(result.ok).toBe(true);
    expect(result.match?.candidates).toEqual([]);
  });

  it("does not return a public-mailbox candidate to automatic outreach", async () => {
    const sql = sqlResponses([leadRow], [], [{
      ...candidateRow,
      recipient_email: "rorfirma@gmail.com",
    }]);
    mocks.getSql.mockReturnValue(sql);

    const result = await getDirectoryGuestLeadMatch(leadRow.id);

    expect(result.ok).toBe(true);
    expect(result.match?.candidates).toEqual([]);
  });
});
