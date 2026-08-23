import { Pool, type QueryResult } from "pg";

import { resolveNodePostgresDatabaseUrl } from "@/lib/db/database-url";

export const REQUIRED_PRODUCTION_MIGRATIONS = [
  "20260823_0065",
  "20260823_0066",
] as const;

type QueryExecutor = (
  text: string,
  values?: readonly unknown[],
) => Promise<Pick<QueryResult, "rows">>;

export type ProductionSchemaHealth = {
  ok: boolean;
  databaseReachable: boolean;
  ledgerPresent: boolean;
  workspaceServiceIdentity: {
    columnPresent: boolean;
    foreignKeyValidated: boolean;
    indexPresent: boolean;
  };
  requiredMigrations: readonly string[];
  appliedMigrations: string[];
  missingMigrations: string[];
};

export async function inspectProductionSchema(
  query: QueryExecutor,
): Promise<ProductionSchemaHealth> {
  const contract = await query(`
    select
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'workspace_services'
          and column_name = 'primary_directory_service_slug'
      ) as column_present,
      exists (
        select 1
        from pg_constraint
        where conname = 'workspace_services_primary_directory_service_fk'
          and convalidated
      ) as foreign_key_validated,
      exists (
        select 1
        from pg_indexes
        where schemaname = 'public'
          and indexname = 'workspace_services_primary_directory_service_idx'
      ) as index_present,
      to_regclass('public.proffera_schema_migrations') is not null as ledger_present
  `);

  const row = contract.rows[0] as {
    column_present?: boolean;
    foreign_key_validated?: boolean;
    index_present?: boolean;
    ledger_present?: boolean;
  } | undefined;

  const ledgerPresent = row?.ledger_present === true;
  let appliedMigrations: string[] = [];

  if (ledgerPresent) {
    const ledger = await query(
      `
        select migration_key
        from proffera_schema_migrations
        where migration_key = any($1::text[])
        order by migration_key
      `,
      [[...REQUIRED_PRODUCTION_MIGRATIONS]],
    );
    appliedMigrations = ledger.rows
      .map((item) => String((item as { migration_key?: unknown }).migration_key ?? ""))
      .filter(Boolean);
  }

  const missingMigrations = REQUIRED_PRODUCTION_MIGRATIONS.filter(
    (migration) => !appliedMigrations.includes(migration),
  );
  const columnPresent = row?.column_present === true;
  const foreignKeyValidated = row?.foreign_key_validated === true;
  const indexPresent = row?.index_present === true;

  return {
    ok:
      ledgerPresent
      && columnPresent
      && foreignKeyValidated
      && indexPresent
      && missingMigrations.length === 0,
    databaseReachable: true,
    ledgerPresent,
    workspaceServiceIdentity: {
      columnPresent,
      foreignKeyValidated,
      indexPresent,
    },
    requiredMigrations: REQUIRED_PRODUCTION_MIGRATIONS,
    appliedMigrations,
    missingMigrations,
  };
}

export async function readProductionSchemaHealth(): Promise<ProductionSchemaHealth> {
  const databaseUrl = resolveNodePostgresDatabaseUrl();
  if (!databaseUrl) {
    return {
      ok: false,
      databaseReachable: false,
      ledgerPresent: false,
      workspaceServiceIdentity: {
        columnPresent: false,
        foreignKeyValidated: false,
        indexPresent: false,
      },
      requiredMigrations: REQUIRED_PRODUCTION_MIGRATIONS,
      appliedMigrations: [],
      missingMigrations: [...REQUIRED_PRODUCTION_MIGRATIONS],
    };
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 1,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
  });

  try {
    return await inspectProductionSchema((text, values) => pool.query(text, values as unknown[]));
  } catch (error) {
    console.error("Production schema health check failed", error);
    return {
      ok: false,
      databaseReachable: false,
      ledgerPresent: false,
      workspaceServiceIdentity: {
        columnPresent: false,
        foreignKeyValidated: false,
        indexPresent: false,
      },
      requiredMigrations: REQUIRED_PRODUCTION_MIGRATIONS,
      appliedMigrations: [],
      missingMigrations: [...REQUIRED_PRODUCTION_MIGRATIONS],
    };
  } finally {
    await pool.end();
  }
}
