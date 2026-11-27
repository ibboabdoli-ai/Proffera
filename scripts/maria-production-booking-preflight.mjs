import { pathToFileURL } from "node:url";

const migrations = ["20261103_0072", "20261105_0073", "20261107_0074", "20261108_0075", "20261110_0076"];
// The owner can hide old years without deleting their bookings. Validate every
// ACTIVE public package from the supported year range, not a frozen 2026 pair.

/** SELECT-only Maria database preflight. Does not authorize public booking. */
export async function inspectMariaProductionBookingDatabase(query) {
  const blockers = [];
  const schemaSql = [
    "select to_regclass('public.proffera_schema_migrations') is not null as ledger,",
    "to_regclass('public.workspaces') is not null as workspaces,",
    "to_regclass('public.workspace_settings') is not null as workspace_settings,",
    "to_regclass('public.workspace_services') is not null as workspace_services,",
    "to_regclass('public.workspace_booking_hours') is not null as booking_hours,",
    "to_regclass('public.public_booking_verifications') is not null as verifications,",
    "to_regclass('public.maria_manual_closed_starts') is not null as manual_closed_starts,",
    "to_regclass('public.maria_service_card_translations') is not null as card_translations,",
    "to_regclass('public.maria_booking_references') is not null as booking_references,",
    "to_regclass('public.maria_booking_reference_counters') is not null as reference_counters,",
    "to_regclass('public.workspace_booking_reminder_settings') is not null as lifecycle_settings,",
    "(select count(*) from information_schema.columns where table_schema='public'",
    "and table_name='workspace_booking_reminder_settings' and (",
    "(column_name='customer_reschedule_enabled' and data_type='boolean' and is_nullable='NO') or",
    "(column_name='customer_cancel_enabled' and data_type='boolean' and is_nullable='NO') or",
    "(column_name='cancel_notice_hours' and data_type='integer' and is_nullable='NO') or",
    "(column_name='no_show_enabled' and data_type='boolean' and is_nullable='NO') or",
    "(column_name='auto_complete_enabled' and data_type='boolean' and is_nullable='NO') or",
    "(column_name='company_confirmation_required' and data_type='boolean' and is_nullable='NO')",
    ")) = 6 as lifecycle_settings_columns,",
    // The canonical 0075 CHECK was missing on upgraded schemas with existing columns.
    "exists (select 1 from pg_constraint c",
    "where c.conrelid=to_regclass('public.workspace_booking_reminder_settings')",
    "and c.contype='c' and c.convalidated",
    "and c.conname='workspace_booking_reminder_settings_cancel_notice_hours_check'",
    // Fail closed unless PostgreSQL deparses the complete canonical AND/range expression.
    "and pg_get_constraintdef(c.oid) =",
    "'CHECK (((cancel_notice_hours >= 0) AND (cancel_notice_hours <= 720)))'",
    ") as lifecycle_cancel_notice_check,",
    "(select count(*) from information_schema.columns where table_schema='public'",
    "and table_name='public_booking_verifications'",
    "and column_name in ('address','postcode','booking_details')) = 3 as verification_contact_columns",
  ].join(" ");
  const schema = (await query(schemaSql)).rows?.[0];
  if (!schema) return { databaseReady: false, blockers: ["schema_unreadable"], appliedMigrations: [] };
  const tables = ["ledger", "workspaces", "workspace_settings", "workspace_services", "booking_hours", "verifications", "manual_closed_starts", "card_translations", "booking_references", "reference_counters", "lifecycle_settings"];
  for (const table of tables) if (schema[table] !== true) blockers.push("missing_" + table);
  if (schema.verification_contact_columns !== true) blockers.push("missing_verification_contact_columns");
  if (schema.lifecycle_settings_columns !== true) blockers.push("invalid_lifecycle_settings_columns");
  if (schema.lifecycle_cancel_notice_check !== true) blockers.push("invalid_lifecycle_cancel_notice_check");

  // Existing relation names and migration receipts do not prove that the
  // IF NOT EXISTS tables have their required columns or constraints.
  if (schema.manual_closed_starts === true && schema.card_translations === true) {
    const integritySql = [
      "select",
      "(select count(*) from information_schema.columns where table_schema='public'",
      "and table_name='maria_manual_closed_starts' and (",
      "(column_name='workspace_id' and udt_name='uuid' and is_nullable='NO') or",
      "(column_name='starts_at' and udt_name='timestamptz' and is_nullable='NO') or",
      "(column_name='created_by' and udt_name='text' and is_nullable='NO') or",
      "(column_name='created_at' and udt_name='timestamptz' and is_nullable='NO')",
      ")) = 4 as manual_closed_columns,",
      "(select count(*) from information_schema.columns where table_schema='public'",
      "and table_name='maria_service_card_translations' and (",
      "(column_name='service_id' and udt_name='uuid' and is_nullable='NO') or",
      "(column_name='locale' and udt_name='text' and is_nullable='NO') or",
      "(column_name='description' and udt_name='text' and is_nullable='NO') or",
      "(column_name='updated_at' and udt_name='timestamptz' and is_nullable='NO')",
      ")) = 4 as card_translations_columns,",
      "exists (select 1 from pg_constraint c",
      "where c.conrelid=to_regclass('public.maria_manual_closed_starts')",
      "and c.contype='p' and c.conname='maria_manual_closed_starts_pk'",
      "and pg_get_constraintdef(c.oid)='PRIMARY KEY (workspace_id, starts_at)') as manual_closed_pk,",
      "exists (select 1 from pg_constraint c",
      "where c.conrelid=to_regclass('public.maria_service_card_translations')",
      "and c.contype='p' and c.conname='maria_service_card_translations_pk'",
      "and pg_get_constraintdef(c.oid)='PRIMARY KEY (service_id, locale)') as card_translations_pk,",
      "exists (select 1 from pg_constraint c",
      "where c.conrelid=to_regclass('public.maria_manual_closed_starts')",
      "and c.contype='f' and c.confrelid=to_regclass('public.workspaces')",
      "and c.confdeltype='c' and pg_get_constraintdef(c.oid)",
      "like 'FOREIGN KEY (workspace_id) REFERENCES %') as manual_closed_fk,",
      "exists (select 1 from pg_constraint c",
      "where c.conrelid=to_regclass('public.maria_service_card_translations')",
      "and c.contype='f' and c.confrelid=to_regclass('public.workspace_services')",
      "and c.confdeltype='c' and pg_get_constraintdef(c.oid)",
      "like 'FOREIGN KEY (service_id) REFERENCES %') as card_translations_fk",
    ].join(" ");
    const integrity = (await query(integritySql)).rows?.[0];
    for (const key of ["manual_closed_columns", "card_translations_columns",
      "manual_closed_pk", "card_translations_pk", "manual_closed_fk", "card_translations_fk"]) {
      if (integrity?.[key] !== true) blockers.push("invalid_" + key);
    }
  }

  // IF NOT EXISTS can leave an incompatible existing table untouched.
  // Never report release-ready if unique references or booking FK protection
  // are missing, even when migration 0076 has a recorded receipt.
  if (schema.booking_references === true && schema.reference_counters === true) {
    const referenceIntegritySql = [
      "select",
      "(select count(*) from information_schema.columns where table_schema='public'",
      "and table_name='maria_booking_reference_counters' and (",
      "(column_name='day_key' and udt_name='text' and is_nullable='NO') or",
      "(column_name='last_number' and udt_name='int8' and is_nullable='NO')",
      ")) = 2 as reference_counter_columns,",
      "(select count(*) from information_schema.columns where table_schema='public'",
      "and table_name='maria_booking_references' and (",
      "(column_name='booking_id' and udt_name='uuid' and is_nullable='NO') or",
      "(column_name='day_key' and udt_name='text' and is_nullable='NO') or",
      "(column_name='day_number' and udt_name='int8' and is_nullable='NO') or",
      "(column_name='reference' and udt_name='text' and is_nullable='NO')",
      ")) = 4 as booking_reference_columns,",
      "exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_reference_counters') AND c.contype='p' AND c.conname='maria_booking_reference_counters_pkey' AND pg_get_constraintdef(c.oid) = 'PRIMARY KEY (day_key)') as reference_counter_pk,",
      "exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_references') AND c.contype='p' AND c.conname='maria_booking_references_pkey' AND pg_get_constraintdef(c.oid) = 'PRIMARY KEY (booking_id)') as booking_reference_pk,",
      "exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_references') AND c.contype='u' AND c.conname='maria_booking_references_reference_key' AND pg_get_constraintdef(c.oid) = 'UNIQUE (reference)') as booking_reference_unique,",
      "exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_references') AND c.contype='u' AND c.conname='maria_booking_reference_day_number_key' AND pg_get_constraintdef(c.oid) = 'UNIQUE (day_key, day_number)') as booking_reference_day_unique,",
      "exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_references') AND c.contype='f' AND c.conname='maria_booking_references_booking_id_fkey' AND c.confrelid=to_regclass('public.bookings') AND c.confdeltype='c' AND pg_get_constraintdef(c.oid) LIKE 'FOREIGN KEY (booking_id) REFERENCES %(id) ON DELETE CASCADE') as booking_reference_booking_fk,",
      "exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_references') AND c.contype='f' AND c.conname='maria_booking_references_day_key_fkey' AND c.confrelid=to_regclass('public.maria_booking_reference_counters') AND c.confdeltype='a' AND pg_get_constraintdef(c.oid) LIKE 'FOREIGN KEY (day_key) REFERENCES %(day_key)') as booking_reference_day_fk,",
      "exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_reference_counters') AND c.contype='c' AND c.conname='maria_booking_reference_counters_day_key_check' AND c.convalidated AND pg_get_constraintdef(c.oid) = 'CHECK ((day_key ~ ''^[0-9]{8}$''::text))') as reference_counter_day_check,",
      "exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_reference_counters') AND c.contype='c' AND c.conname='maria_booking_reference_counters_last_number_check' AND c.convalidated AND pg_get_constraintdef(c.oid) = 'CHECK (((last_number >= 1) AND (last_number <= 999999999)))') as reference_counter_number_check,",
      "exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_references') AND c.contype='c' AND c.conname='maria_booking_references_day_number_check' AND c.convalidated AND pg_get_constraintdef(c.oid) = 'CHECK (((day_number >= 1) AND (day_number <= 999999999)))') as booking_reference_number_check,",
      "exists (select 1 from pg_constraint c where c.conrelid=to_regclass('public.maria_booking_references') AND c.contype='c' AND c.conname='maria_booking_references_reference_check' AND c.convalidated AND pg_get_constraintdef(c.oid) = 'CHECK ((reference ~ ''^MBM-[0-9]{10,}$''::text))') as booking_reference_format_check",
    ].join(" ");
    const integrity = (await query(referenceIntegritySql)).rows?.[0];
    for (const key of [
      "reference_counter_columns", "booking_reference_columns",
      "reference_counter_pk", "booking_reference_pk", "booking_reference_unique", "booking_reference_day_unique", "booking_reference_booking_fk", "booking_reference_day_fk", "reference_counter_day_check", "reference_counter_number_check", "booking_reference_number_check", "booking_reference_format_check",
    ]) {
      if (integrity?.[key] !== true) blockers.push("invalid_" + key);
    }
  }

  let appliedMigrations = [];
  if (schema.ledger === true) {
    const rows = await query("select migration_key from proffera_schema_migrations where migration_key in ('20261103_0072','20261105_0073','20261107_0074','20261108_0075','20261110_0076')");
    appliedMigrations = rows.rows.map(row => String(row.migration_key));
    for (const key of migrations) if (!appliedMigrations.includes(key)) blockers.push("missing_migration_" + key);
  }

  if (["workspaces", "workspace_settings", "workspace_services", "booking_hours"].every(table => schema[table] === true)) {
    const rows = await query([
      "select w.id::text as id, w.status, w.public_booking_slug,",
      "coalesce(nullif(ws.contact_email,''),'') as owner_email,",
      "coalesce(nullif(ws.time_zone,''),'Europe/Stockholm') as time_zone,",
      "ws.billing_currency as billing_currency",
      "from workspaces w left join workspace_settings ws on ws.workspace_id = w.id::text",
      "where w.slug = 'makeup-by-maria' limit 2",
    ].join(" "));
    const w = rows.rows.length === 1 ? rows.rows[0] : null;
    if (!w || !["active", "trial"].includes(String(w.status)) || w.public_booking_slug !== "makeup-by-maria"
      || w.time_zone !== "Europe/Stockholm" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(w.owner_email ?? ""))) {
      blockers.push("maria_workspace_not_ready");
    } else {
      if (w.billing_currency !== "SEK") blockers.push("maria_billing_currency_not_sek");
      const services = await query([
        "select public_slug, price_amount_minor, price_type, duration_minutes, maximum_advance_days",
        "from workspace_services where workspace_id=$1",
        "and public_slug ~ '^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$'",
        "and is_active=true and public_status='published'",
      ].join(" "), [w.id]);
      const publicServices = services.rows;
      if (publicServices.length === 0) blockers.push("maria_no_published_services");
      const seenSlugs = new Set();
      for (const service of publicServices) {
        const slug = String(service.public_slug);
        if (seenSlugs.has(slug)) blockers.push("maria_services_ambiguous");
        seenSlugs.add(slug);
        const priceMinor = Number(service.price_amount_minor);
        const duration = Number(service.duration_minutes);
        const advance = Number(service.maximum_advance_days);
        if (service.price_type !== "fixed"
          || service.price_amount_minor === null || service.price_amount_minor === undefined
          || !Number.isSafeInteger(priceMinor) || priceMinor < 1 || priceMinor > 25000000
          || !Number.isInteger(duration) || duration < 1 || duration > 1440
          || !Number.isInteger(advance) || advance < 1 || advance > 730) {
          blockers.push("service_not_ready_" + slug);
        }
      }
      const hours = await query("select weekday, opens_at::text as opens_at, closes_at::text as closes_at, is_closed from workspace_booking_hours where workspace_id=$1 and weekday in (0,5,6)", [w.id]);
      if (!hours.rows.some(h => [0,5,6].includes(Number(h.weekday)) && h.is_closed === false
        && /^\d{2}:\d{2}/.test(String(h.opens_at)) && /^\d{2}:\d{2}/.test(String(h.closes_at))
        && String(h.opens_at) < String(h.closes_at))) blockers.push("maria_weekend_hours_not_ready");
    }
  }
  return { databaseReady: blockers.length === 0, blockers, appliedMigrations };
}

async function main() {
  if (!process.argv.includes("--read-only")) throw Error("Read-only confirmation required");
  if (!process.env.DATABASE_URL) throw Error("Authorized Proffera Production DATABASE_URL required");
  const { Client } = await import("pg");
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query("SET LOCAL statement_timeout = '10s'");
    const result = await inspectMariaProductionBookingDatabase((sql, params) => client.query(sql, params));
    process.stdout.write(JSON.stringify({ ...result, requiredMigrations: migrations,
      productionBookingEnabled: false,
      note: "Read-only data check only; all Production booking, OTP recipient and manager actions require independent flag and release authorization.",
    }, null, 2) + "\n");
    if (!result.databaseReady) process.exitCode = 2;
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    await client.end();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    process.stderr.write("Maria preflight unavailable: check authorization, connectivity and schema.\n");
    process.exitCode = 1;
  });
}
