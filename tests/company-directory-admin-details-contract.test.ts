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

function normalize(strings: TemplateStringsArray) {
  return strings.join(" ").replace(/\s+/g, " ").trim();
}

function buildSql(events: string[]) {
  return vi.fn(async (strings: TemplateStringsArray) => {
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

    if (query.includes("company_directory_profile_services")) {
      return [{ value: { profile_id: PROFILE_ID, service_slug: "elinstallation" } }];
    }
    if (query.includes("company_directory_business_locations")) {
      return [{ value: { profile_id: PROFILE_ID, latitude: 59.33, longitude: 18.06 } }];
    }
    if (query.includes("select count(*)::int as count from company_directory_field_sources")) {
      return [{ count: 3 }];
    }
    if (query.includes("select to_jsonb(source) as value from company_directory_field_sources")) {
      return [{ value: { field_name: "address_line1", source_name: "scb" } }];
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

  it("renders selected profile, SCB evidence, workplace addresses and bounded source totals", async () => {
    const events: string[] = [];
    mocks.requireSuperAdmin.mockImplementation(async () => { events.push("auth"); });
    mocks.getSql.mockImplementation(() => buildSql(events));

    const element = await DirectoryAdminDetailsPage({ searchParams: Promise.resolve({ profile: PROFILE_ID }) });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Example Elektriska AB");
    expect(html).toContain("0701234567");
    expect(html).toContain("Besöksgatan 5");
    expect(html).toContain("BOX 10");
    expect(html).toContain("Raw SCB enrichment");
    expect(html).toContain("Fältkällor · visar senaste 1 av 3");
  });
});
