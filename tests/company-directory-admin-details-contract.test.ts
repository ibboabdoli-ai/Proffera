import { renderToStaticMarkup } from "react-dom/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSuperAdmin: vi.fn(),
  getSql: vi.fn(),
}));

vi.mock("@/lib/admin-authorization", () => ({ requireSuperAdmin: mocks.requireSuperAdmin }));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import DirectoryAdminDetailsPage from "../src/app/admin/foretag/directory/details/page";

const PROFILE_ID = "00000000-0000-4000-8000-000000000001";

type OffsetLog = {
  service: number[];
  location: number[];
};

function normalize(strings: TemplateStringsArray) {
  return strings.join(" ").replace(/\s+/g, " ").trim();
}

function buildSql(events: string[], offsets: OffsetLog = { service: [], location: [] }) {
  return vi.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    events.push("sql");
    const query = normalize(strings);

    if (query.includes("select p.id::text") && query.includes("from company_directory_profiles p")) {
      return [{
        id: PROFILE_ID,
        display_name: "Example Elektriska AB",
        legal_name: "Example Elektriska AB",
        organization_number: "5563115707",
        publication_status: "published",
        quality_score: 100,
        city: "STOCKHOLM",
        category_slug: "elektriker",
        scb_last_synced_at: "2026-08-21T08:00:00Z",
        scb_conflict_count: 0,
      }];
    }

    if (query.includes("to_jsonb(p) as profile")) {
      return [{
        profile: {
          id: PROFILE_ID,
          display_name: "Example Elektriska AB",
          legal_name: "Example Elektriska AB",
          organization_number: "5563115707",
          publication_status: "published",
          quality_score: 100,
          primary_sni_code: "43.210",
          primary_sni_label: "Elinstallationer",
          address_line1: "Profilgatan 1",
          postal_code: "11122",
          city: "STOCKHOLM",
          municipality: "Stockholm",
          website_url: "https://example.test",
          activity_description: "Elinstallationer",
          public_slug: "example-elektriska-ab-115707",
        },
        official_facts: {
          registered_names: ["Example Elektriska AB"],
          sni_codes: [{ code: "43.210" }],
          registration_date: "2021-01-01",
          deregistration_date: null,
          advertising_blocked: false,
          ongoing_procedures: [],
        },
        scb: {
          phone: "0701234567",
          email: "info@example.test",
          postal_address: { addressLine: "BOX 10", postalCode: "111 20", city: "STOCKHOLM" },
          municipality: "Stockholm",
          sni_codes: ["43.210"],
          conflicts: [],
          workplaces: [{
            cfarNumber: "12345678",
            name: "Example arbetsställe",
            phone: "0701234567",
            email: "workplace@example.test",
            visitingAddress: { addressLine: "Besöksgatan 5", postalCode: "111 22", city: "STOCKHOLM" },
            postalAddress: { addressLine: "BOX 10", postalCode: "111 20", city: "STOCKHOLM" },
            sniCodes: ["43.210"],
            coordinates: { northing: 6580000, easting: 674000, crs: "SWEREF99" },
          }],
        },
        official_facts_fresh: true,
        scb_snapshot_fresh: true,
        scb_conflict_count: 0,
      }];
    }

    if (query.includes("select count(*)::int as count from company_directory_profile_services")) return [{ count: 51 }];
    if (query.includes("select count(*)::int as count from company_directory_business_locations")) return [{ count: 51 }];
    if (query.includes("select count(*)::int as count from company_directory_field_sources")) return [{ count: 101 }];

    if (query.includes("select to_jsonb(service) as value from company_directory_profile_services")) {
      if (!query.includes("order by service.created_at, service.service_slug limit 50 offset")) {
        throw new Error(`Unbounded service query in admin details test: ${query}`);
      }
      const offset = Number(values.at(-1));
      offsets.service.push(offset);
      return [{ value: {
        profile_id: PROFILE_ID,
        service_slug: offset === 50 ? "second-page-service" : "first-page-service",
      } }];
    }

    if (query.includes("select to_jsonb(location) as value from company_directory_business_locations")) {
      if (!query.includes("order by location.created_at, location.profile_id limit 50 offset")) {
        throw new Error(`Unbounded or unstable location query in admin details test: ${query}`);
      }
      const offset = Number(values.at(-1));
      offsets.location.push(offset);
      return [{ value: {
        profile_id: PROFILE_ID,
        latitude: offset === 50 ? 60.01 : 59.33,
        longitude: offset === 50 ? 18.99 : 18.06,
        geocode_source: offset === 50 ? "second-page-location" : "first-page-location",
      } }];
    }

    if (query.includes("select to_jsonb(source) as value from company_directory_field_sources")) {
      const requiredOrdering = "order by source.observed_at desc nulls last, source.created_at desc, source.id limit 100";
      if (!query.includes(requiredOrdering)) {
        throw new Error(`Unbounded or unordered field-source query in admin details test: ${query}`);
      }
      return Array.from({ length: 100 }, (_, index) => ({
        value: { field_name: `field_${index + 1}`, source_name: "scb" },
      }));
    }

    throw new Error(`Unexpected SQL in admin details test: ${query}`);
  });
}

describe("Company Directory full admin details", () => {
  beforeEach(() => {
    mocks.requireSuperAdmin.mockReset();
    mocks.getSql.mockReset();
  });

  it("authorizes before accessing SQL", async () => {
    const events: string[] = [];
    mocks.requireSuperAdmin.mockImplementation(async () => { events.push("auth"); });
    mocks.getSql.mockImplementation(() => { events.push("getSql"); return buildSql(events); });

    await DirectoryAdminDetailsPage({ searchParams: Promise.resolve({ profile: PROFILE_ID }) });

    expect(events[0]).toBe("auth");
    expect(events[1]).toBe("getSql");
    expect(events).toContain("sql");
  });

  it("does not access the database when super-admin authorization fails", async () => {
    mocks.requireSuperAdmin.mockRejectedValue(new Error("Super admin access required"));

    await expect(DirectoryAdminDetailsPage({ searchParams: Promise.resolve({ profile: PROFILE_ID }) }))
      .rejects.toThrow("Super admin access required");
    expect(mocks.getSql).not.toHaveBeenCalled();
  });

  it("renders page two with bound offsets, stable ordering and bounded source totals", async () => {
    const events: string[] = [];
    const offsets: OffsetLog = { service: [], location: [] };
    mocks.requireSuperAdmin.mockImplementation(async () => { events.push("auth"); });
    mocks.getSql.mockImplementation(() => buildSql(events, offsets));

    const element = await DirectoryAdminDetailsPage({
      searchParams: Promise.resolve({
        profile: PROFILE_ID,
        servicePage: "2",
        locationPage: "2",
      }),
    });
    const html = renderToStaticMarkup(element);

    expect(offsets.service).toContain(50);
    expect(offsets.location).toContain(50);
    expect(html).toContain("Example Elektriska AB");
    expect(html).toContain("0701234567");
    expect(html).toContain("Besöksgatan 5");
    expect(html).toContain("BOX 10");
    expect(html).toContain("Raw SCB enrichment");
    expect(html).toContain("second-page-service");
    expect(html).toContain("second-page-location");
    expect(html).toContain("Tjänster · visar 1 av 51");
    expect(html).toContain("Tjänster: sida 2 av 2");
    expect(html).toContain("Geografiska platser · visar 1 av 51");
    expect(html).toContain("Geografiska platser: sida 2 av 2");
    expect(html).toContain("Fältkällor · visar senaste 100 av 101");
  });
});
