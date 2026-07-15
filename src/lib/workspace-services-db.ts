import "server-only";

import { neon } from "@neondatabase/serverless";

import { getUserWorkspaceAccess } from "@/lib/workspace-access";

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

async function getActiveWorkspaceId() {
  const access = await getUserWorkspaceAccess();

  if (!access.ok) {
    throw new Error("A valid workspace membership is required for workspace services");
  }

  return access.workspaceId;
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

export type WriteDashboardWorkspaceServiceInput = {
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

export type UpdateDashboardWorkspaceServiceInput = WriteDashboardWorkspaceServiceInput & {
  id: string;
};

export async function getDashboardWorkspaceServices(): Promise<DashboardWorkspaceService[]> {
  const sql = getSqlClient();

  if (!sql) {
    return [];
  }

  try {
    const workspaceId = await getActiveWorkspaceId();
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
      where workspace_id = ${workspaceId}
      order by sort_order asc, name asc
    `;

    return rows.map((row) => ({
      id: toText(row.id),
      workspaceId: toText(row.workspace_id),
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

export async function createDashboardWorkspaceService(input: WriteDashboardWorkspaceServiceInput) {
  const sql = getSqlClient();

  if (!sql) {
    throw new Error("Missing database connection for workspace service create");
  }

  const workspaceId = await getActiveWorkspaceId();

  const rows = await sql`
    insert into workspace_services (
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
    )
    values (
      ${workspaceId},
      ${input.name},
      ${input.description},
      ${input.category},
      ${input.priceLabel},
      ${input.basePriceSek},
      ${input.durationMinutes},
      ${input.serviceArea},
      ${input.isActive},
      ${input.sortOrder}
    )
    returning id
  `;

  if (!rows[0]) {
    throw new Error("Workspace service was not created");
  }
}

export async function updateDashboardWorkspaceService(input: UpdateDashboardWorkspaceServiceInput) {
  const sql = getSqlClient();

  if (!sql) {
    throw new Error("Missing database connection for workspace service update");
  }

  const workspaceId = await getActiveWorkspaceId();

  const rows = await sql`
    update workspace_services
    set
      name = ${input.name},
      description = ${input.description},
      category = ${input.category},
      price_label = ${input.priceLabel},
      base_price_sek = ${input.basePriceSek},
      duration_minutes = ${input.durationMinutes},
      service_area = ${input.serviceArea},
      is_active = ${input.isActive},
      sort_order = ${input.sortOrder},
      updated_at = now()
    where id = ${input.id}
      and workspace_id = ${workspaceId}
    returning id
  `;

  if (!rows[0]) {
    throw new Error("Workspace service was not found for the active workspace");
  }
}
