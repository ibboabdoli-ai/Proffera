import { neon } from "@neondatabase/serverless";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

function getSqlClient() {
  if (!connectionString) {
    return null;
  }

  return neon(connectionString);
}

function toText(value: unknown, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsedValue = Number(value);

  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value).toLowerCase() === "true";
}

export type DashboardWorkspaceService = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  category: string;
  priceLabel: string;
  basePriceSek: number | null;
  durationMinutes: number | null;
  serviceArea: string;
  isActive: boolean;
  sortOrder: number;
};

export async function getDashboardWorkspaceServices(): Promise<DashboardWorkspaceService[]> {
  const sql = getSqlClient();

  if (!sql) {
    return [];
  }

  try {
    const rows = await sql`
      select
        id,
        workspace_id,
        name,
        description,
        category,
        price_label,
        base_price_sek,
        duration_minutes,
        service_area,
        is_active,
        sort_order
      from workspace_services
      where workspace_id = 'default'
      order by sort_order asc, name asc
    `;

    return rows.map((row) => ({
      id: toText(row.id),
      workspaceId: toText(row.workspace_id, "default"),
      name: toText(row.name),
      description: toText(row.description),
      category: toText(row.category),
      priceLabel: toText(row.price_label),
      basePriceSek: toNumber(row.base_price_sek),
      durationMinutes: toNumber(row.duration_minutes),
      serviceArea: toText(row.service_area),
      isActive: toBoolean(row.is_active, true),
      sortOrder: toNumber(row.sort_order) ?? 100,
    }));
  } catch (error) {
    console.error("Failed to read workspace services", error);
    return [];
  }
}
