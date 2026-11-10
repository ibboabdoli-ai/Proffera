import { describe, expect, it } from "vitest";
import { inspectMariaProductionBookingDatabase } from "./maria-production-booking-preflight.mjs";

const schemaReady = {
  ledger: true, workspaces: true, workspace_settings: true, workspace_services: true,
  booking_hours: true, verifications: true, manual_closed_starts: true,
  card_translations: true, booking_references: true, reference_counters: true, verification_contact_columns: true,
  lifecycle_settings: true, lifecycle_settings_columns: true, lifecycle_cancel_notice_check: true,
};
const integrityReady = {
  manual_closed_columns: true, card_translations_columns: true,
  manual_closed_pk: true, card_translations_pk: true,
  manual_closed_fk: true, card_translations_fk: true,
};
const referenceIntegrityReady = {
  reference_counter_columns:true, booking_reference_columns:true,
  reference_counter_pk:true, booking_reference_pk:true,
  booking_reference_unique:true, booking_reference_day_unique:true,
  booking_reference_booking_fk:true, booking_reference_day_fk:true,
  reference_counter_day_check:true, reference_counter_number_check:true,
  booking_reference_number_check:true, booking_reference_format_check:true,
};

function mockReadOnlyQuery({ schema = schemaReady, migrations = ["20261103_0072", "20261105_0073", "20261107_0074", "20261108_0075", "20261110_0076"],
  workspaceReady = true, priceOverride = null, hoursReady = true,
  billingCurrency = "SEK", integrity = integrityReady, referenceIntegrity = referenceIntegrityReady,
  serviceRows = null } = {}) {
  const executed = [];
  async function query(sql, params) {
    const statement = sql.trim();
    executed.push({ statement, params });
    if (!/^select\b/i.test(statement)) throw new Error("Unexpected non-read query");
    if (statement.includes("as manual_closed_columns")) return { rows: [integrity] };
    if (statement.includes("as booking_reference_columns")) return { rows: [referenceIntegrity] };
    if (statement.includes("to_regclass(")) return { rows: [schema] };
    if (statement.includes("from proffera_schema_migrations")) {
      return { rows: migrations.map(migration_key => ({ migration_key })) };
    }
    if (statement.includes("from workspaces w")) {
      return { rows: workspaceReady ? [{
        id: "11111111-2222-4333-8444-555555555555", status: "active",
        public_booking_slug: "makeup-by-maria", owner_email: "synthetic@example.invalid",
        time_zone: "Europe/Stockholm", billing_currency: billingCurrency,
      }] : [] };
    }
    if (statement.includes("from workspace_services")) return { rows: serviceRows ?? [
      { public_slug: "maria-bridal-trial-2026", price_amount_minor: priceOverride === null ? 600000 : priceOverride,
        price_type: "fixed", public_status: "published", is_active: true, duration_minutes: 180, maximum_advance_days: 365 },
      { public_slug: "maria-bridal-without-trial-2026", price_amount_minor: 500000,
        price_type: "fixed", public_status: "published", is_active: true, duration_minutes: 180, maximum_advance_days: 365 },
    ] };
    if (statement.includes("from workspace_booking_hours")) return { rows: hoursReady ? [
      { weekday: 5, opens_at: "07:00:00", closes_at: "10:00:00", is_closed: false },
    ] : [] };
    throw new Error("Unexpected query: " + statement.slice(0, 80));
  }
  return { query, executed };
}

describe("Maria Production booking release is inspection-only", () => {
  it("reports database readiness only after all five migrations, matching services and opening hours", async () => {
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

  it("requires migrations 0072 through 0076 to be recorded independently", async () => {
    const result = await inspectMariaProductionBookingDatabase(mockReadOnlyQuery({
      migrations: ["20261105_0073"],
    }).query);
    expect(result.databaseReady).toBe(false);
    expect(result.blockers).toContain("missing_migration_20261103_0072");
    expect(result.blockers).toContain("missing_migration_20261107_0074");
    expect(result.blockers).toContain("missing_migration_20261108_0075");
    expect(result.blockers).toContain("missing_migration_20261110_0076");
  });

  it("refuses a missing 0076 receipt or new reference tables", async () => {
    const noLedger = await inspectMariaProductionBookingDatabase(mockReadOnlyQuery({
      migrations: ["20261103_0072", "20261105_0073", "20261107_0074", "20261108_0075"],
    }).query);
    expect(noLedger.databaseReady).toBe(false);
    expect(noLedger.blockers).toContain("missing_migration_20261110_0076");
    const noTables = await inspectMariaProductionBookingDatabase(mockReadOnlyQuery({
      schema: { ...schemaReady, booking_references: false, reference_counters: false },
    }).query);
    expect(noTables.databaseReady).toBe(false);
    expect(noTables.blockers).toEqual(expect.arrayContaining([
      "missing_booking_references", "missing_reference_counters",
    ]));
  });

  it("fails closed on absent 0075 lifecycle columns or range constraint", async () => {
    const result = await inspectMariaProductionBookingDatabase(mockReadOnlyQuery({
      schema: {
        ...schemaReady, lifecycle_settings: false,
        lifecycle_settings_columns: false, lifecycle_cancel_notice_check: false,
      },
    }).query);
    expect(result.databaseReady).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      "missing_lifecycle_settings",
      "invalid_lifecycle_settings_columns",
      "invalid_lifecycle_cancel_notice_check",
    ]));
  });

  it("accepts approved and later edited prices without freezing the original launch amounts", async () => {
    for (const approvedPrice of [600000, 675000, 690000]) {
      const result = await inspectMariaProductionBookingDatabase(mockReadOnlyQuery({ priceOverride: approvedPrice }).query);
      expect(result.databaseReady).toBe(true);
      expect(result.blockers).toEqual([]);
    }
  });

  it("rejects invalid fixed-price amounts without weakening service readiness", async () => {
    for (const invalidPrice of [0, 25000001, "invalid-price"]) {
      const result = await inspectMariaProductionBookingDatabase(mockReadOnlyQuery({ priceOverride: invalidPrice }).query);
      expect(result.databaseReady).toBe(false);
      expect(result.blockers).toContain("service_not_ready_maria-bridal-trial-2026");
    }
    const missingOwner = await inspectMariaProductionBookingDatabase(mockReadOnlyQuery({ workspaceReady: false }).query);
    expect(missingOwner.blockers).toContain("maria_workspace_not_ready");
  });

  it("keeps release preflight ready after the owner hides 2026 and publishes 2027", async () => {
    const future = {
      public_slug: "maria-bridal-trial-2027",
      price_amount_minor: 610000, price_type: "fixed",
      is_active: true, public_status: "published",
      duration_minutes: 180, maximum_advance_days: 365,
    };
    const result = await inspectMariaProductionBookingDatabase(mockReadOnlyQuery({
      serviceRows: [future],
    }).query);
    expect(result.databaseReady).toBe(true);
    expect(result.blockers).toEqual([]);
    const noPublishedYear = await inspectMariaProductionBookingDatabase(mockReadOnlyQuery({
      serviceRows: [],
    }).query);
    expect(noPublishedYear.databaseReady).toBe(false);
    expect(noPublishedYear.blockers).toContain("maria_no_published_services");
  });

  it("rejects unsafe active packages in future years even when 2026 remains valid", async () => {
    const older = [
      {public_slug:"maria-bridal-trial-2026",price_amount_minor:600000,
        price_type:"fixed",duration_minutes:180,maximum_advance_days:365},
      {public_slug:"maria-bridal-without-trial-2026",price_amount_minor:500000,
        price_type:"fixed",duration_minutes:180,maximum_advance_days:365},
    ];
    for (const invalid of [
      {price_amount_minor:0,price_type:"fixed",duration_minutes:180,maximum_advance_days:365},
      {price_amount_minor:550000,price_type:"quote",duration_minutes:180,maximum_advance_days:365},
      {price_amount_minor:550000,price_type:"fixed",duration_minutes:0,maximum_advance_days:365},
    ]) {
      const service = {...invalid,public_slug:"maria-bridal-trial-2028"};
      const result = await inspectMariaProductionBookingDatabase(mockReadOnlyQuery({
        serviceRows: [...older, service],
      }).query);
      expect(result.databaseReady).toBe(false);
      expect(result.blockers).toContain("service_not_ready_maria-bridal-trial-2028");
    }
  });

  it("requires an open weekend window", async () => {
    const result = await inspectMariaProductionBookingDatabase(mockReadOnlyQuery({ hoursReady: false }).query);
    expect(result.databaseReady).toBe(false);
    expect(result.blockers).toContain("maria_weekend_hours_not_ready");
  });

  it("rejects correct numeric prices when workspace billing is not SEK", async () => {
    const { query } = mockReadOnlyQuery({ billingCurrency: "EUR" });
    const result = await inspectMariaProductionBookingDatabase(query);
    expect(result.databaseReady).toBe(false);
    expect(result.blockers).toContain("maria_billing_currency_not_sek");
  });

  it("rejects a table with missing required columns despite a valid table name and migration receipt", async () => {
    const { query } = mockReadOnlyQuery({
      integrity: { ...integrityReady, card_translations_columns: false },
    });
    const result = await inspectMariaProductionBookingDatabase(query);
    expect(result.databaseReady).toBe(false);
    expect(result.blockers).toContain("invalid_card_translations_columns");
  });

  it("rejects a malformed 0076 reference table despite valid migration receipts", async () => {
    for (const invalidKey of ["booking_reference_unique", "booking_reference_booking_fk",
      "booking_reference_columns", "reference_counter_pk", "booking_reference_day_unique",
      "reference_counter_day_check", "reference_counter_number_check",
      "booking_reference_number_check", "booking_reference_format_check"]) {
      const {query} = mockReadOnlyQuery({
        referenceIntegrity: {...referenceIntegrityReady, [invalidKey]:false},
      });
      const result = await inspectMariaProductionBookingDatabase(query);
      expect(result.databaseReady).toBe(false);
      expect(result.blockers).toContain("invalid_" + invalidKey);
      expect(result.appliedMigrations).toContain("20261110_0076");
    }
  });

  it("rejects missing primary/foreign keys on both Maria tables", async () => {
    const { query } = mockReadOnlyQuery({
      integrity: { ...integrityReady, manual_closed_pk: false, card_translations_fk: false },
    });
    const result = await inspectMariaProductionBookingDatabase(query);
    expect(result.databaseReady).toBe(false);
    expect(result.blockers).toContain("invalid_manual_closed_pk");
    expect(result.blockers).toContain("invalid_card_translations_fk");
  });

});
