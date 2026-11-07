import { describe, expect, it } from "vitest";
import { inspectMariaProductionBookingDatabase } from "./maria-production-booking-preflight.mjs";

const schemaReady = {
  ledger: true, workspaces: true, workspace_settings: true, workspace_services: true,
  booking_hours: true, verifications: true, manual_closed_starts: true,
  card_translations: true, verification_contact_columns: true,
};

function mockReadOnlyQuery({ schema = schemaReady, migrations = ["20261103_0072", "20261105_0073", "20261107_0074"],
  workspaceReady = true, priceOverride = null, hoursReady = true } = {}) {
  const executed = [];
  async function query(sql, params) {
    const statement = sql.trim();
    executed.push({ statement, params });
    if (!/^select\b/i.test(statement)) throw new Error("Unexpected non-read query");
    if (statement.includes("to_regclass(")) return { rows: [schema] };
    if (statement.includes("from proffera_schema_migrations")) {
      return { rows: migrations.map(migration_key => ({ migration_key })) };
    }
    if (statement.includes("from workspaces w")) {
      return { rows: workspaceReady ? [{
        id: "11111111-2222-4333-8444-555555555555", status: "active",
        public_booking_slug: "makeup-by-maria", owner_email: "synthetic@example.invalid",
        time_zone: "Europe/Stockholm",
      }] : [] };
    }
    if (statement.includes("from workspace_services")) return { rows: [
      { public_slug: "maria-bridal-trial-2026", price_amount_minor: priceOverride ?? 690000,
        price_type: "fixed", public_status: "published", is_active: true, duration_minutes: 180 },
      { public_slug: "maria-bridal-without-trial-2026", price_amount_minor: 580000,
        price_type: "fixed", public_status: "published", is_active: true, duration_minutes: 180 },
    ] };
    if (statement.includes("from workspace_booking_hours")) return { rows: hoursReady ? [
      { weekday: 5, opens_at: "07:00:00", closes_at: "10:00:00", is_closed: false },
    ] : [] };
    throw new Error("Unexpected query: " + statement.slice(0, 80));
  }
  return { query, executed };
}

describe("Maria Production booking release is inspection-only", () => {
  it("reports database readiness only after all three migrations, matching services and opening hours", async () => {
    const { query, executed } = mockReadOnlyQuery();
    const result = await inspectMariaProductionBookingDatabase(query);
    expect(result.databaseReady).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(executed.every(item => /^select\b/i.test(item.statement))).toBe(true);
    expect(executed.filter(item => item.params).every(item =>
      item.params[0] === "11111111-2222-4333-8444-555555555555")).toBe(true);
    expect(result).not.toHaveProperty("bookingEnabled", true);
  });

  it("fails closed if the manual-closure table or contact columns are missing", async () => {
    const { query } = mockReadOnlyQuery({
      schema: { ...schemaReady, manual_closed_starts: false, verification_contact_columns: false },
    });
    const result = await inspectMariaProductionBookingDatabase(query);
    expect(result.databaseReady).toBe(false);
    expect(result.blockers).toContain("missing_manual_closed_starts");
    expect(result.blockers).toContain("missing_verification_contact_columns");
  });

  it("does not query an absent migration ledger or invent migration receipts", async () => {
    const { query, executed } = mockReadOnlyQuery({ schema: { ...schemaReady, ledger: false } });
    const result = await inspectMariaProductionBookingDatabase(query);
    expect(result.databaseReady).toBe(false);
    expect(result.blockers).toContain("missing_ledger");
    expect(executed.some(item => item.statement.includes("from proffera_schema_migrations"))).toBe(false);
  });

  it("requires migration 0072, 0073 and 0074 to be recorded independently", async () => {
    const result = await inspectMariaProductionBookingDatabase(mockReadOnlyQuery({
      migrations: ["20261105_0073"],
    }).query);
    expect(result.databaseReady).toBe(false);
    expect(result.blockers).toContain("missing_migration_20261103_0072");
    expect(result.blockers).toContain("missing_migration_20261107_0074");
  });

  it("does not confuse old Production prices or missing owner data with publishable readiness", async () => {
    const mismatch = await inspectMariaProductionBookingDatabase(mockReadOnlyQuery({ priceOverride: 600000 }).query);
    expect(mismatch.blockers).toContain("service_not_ready_maria-bridal-trial-2026");
    const missingOwner = await inspectMariaProductionBookingDatabase(mockReadOnlyQuery({ workspaceReady: false }).query);
    expect(missingOwner.blockers).toContain("maria_workspace_not_ready");
  });

  it("requires an open weekend window", async () => {
    const result = await inspectMariaProductionBookingDatabase(mockReadOnlyQuery({ hoursReady: false }).query);
    expect(result.databaseReady).toBe(false);
    expect(result.blockers).toContain("maria_weekend_hours_not_ready");
  });
});
