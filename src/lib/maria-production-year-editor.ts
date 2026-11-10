import "server-only";

import { getSql } from "@/lib/db/server";

/**
 * Production Maria year-editor gate. Public booking is a separate switch and
 * must never become bookable merely because the owner edits price/card text.
 *
 * Keep this OFF until a separately approved Production schema rollout and
 * explicit manager-editor release. Checks a real ledger entry and table,
 * not just the presence of an environment variable.
 */
export async function isMariaProductionYearEditorReady(): Promise<boolean> {
  if (process.env.VERCEL_ENV !== "production"
    || process.env.PROFFERA_MARIA_PRODUCTION_YEAR_EDITOR_ENABLED !== "true") {
    return false;
  }
  const sql = getSql();
  if (!sql) return false;

  try {
    const rows = await sql`
      select
        to_regclass('public.maria_service_card_translations') is not null as translation_table_ready,
        to_regclass('public.proffera_schema_migrations') is not null as ledger_ready
    `;
    if (rows[0]?.translation_table_ready !== true || rows[0]?.ledger_ready !== true) return false;
    const ledger = await sql`
      select exists (
        select 1 from proffera_schema_migrations
        where migration_key = '20261107_0074'
      ) as translation_migration_applied
    `;
    return ledger[0]?.translation_migration_applied === true;
  } catch (error) {
    console.error("Maria Production year editor schema gate failed", error);
    return false;
  }
}
