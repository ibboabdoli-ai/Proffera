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

function queryText(call: unknown[] | undefined) {
  const strings = call?.[0] as readonly string[] | undefined;
  return (strings ?? []).join(" ? ").replace(/\s+/g, " ").trim();
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

const candidateRow = {
  profile_id: "22222222-2222-4222-8222-222222222222",
  public_slug: "ror-ab",
  display_name: "Rör AB",
  city: "Södertälje",
  municipality: "Södertälje",
  category_slug: "vvs",
  quality_score: 95,
  service_slug: "vvs",
  service_name: "VVS / Rörmokare",
  service_category: "VVS",
  latitude: 59.1955,
  longitude: 17.6253,
  service_area_radius_km: 25,
  recipient_email: "offert@rorfirma.se",
  scb_conflicts: [],
};

describe("single-request Marketplace readiness gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires verified Lantmäteriet coordinates and one unambiguous SCB workplace in the candidate query", async () => {
    const sql = sqlResponses([leadRow], [], [candidateRow]);
    mocks.getSql.mockReturnValue(sql);

    const result = await getDirectoryGuestLeadMatch(leadRow.id);

    expect(result.ok).toBe(true);
    expect(result.match?.candidates).toHaveLength(1);
    const candidateQuery = queryText(sql.mock.calls[2]);
    expect(candidateQuery).toContain("location.geocode_source = 'lantmateriet_belagenhetsadress_v4_2'");
    expect(candidateQuery).toContain("location.geocode_precision = 'address'");
    expect(candidateQuery).toContain("location.geocode_confidence = 100");
    expect(candidateQuery).toContain("workplace_evidence.visiting_count = 1");
    expect(candidateQuery).toContain("workplace_evidence.visiting_count = 0 and workplace_evidence.postal_count = 1");
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
