import "server-only";

import { neon } from "@neondatabase/serverless";

import { getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

const LEGACY_WORKSPACE_ID = "default";

function getSqlClient() {
  if (!connectionString) {
    return null;
  }

  return neon(connectionString);
}

async function getActiveWorkspaceId() {
  const access = await getUserWorkspaceAccess();

  if (!access.ok) {
    return LEGACY_WORKSPACE_ID;
  }

  return access.workspaceId;
}

function toText(value: unknown, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
}

function toLeadSourceLabel(value: unknown) {
  const source = toText(value, "dashboard_manual");

  if (source === "service_ai_chat" || source === "ai_chat") {
    return "AI-chatt";
  }

  if (source === "web_form" || source === "webbformular") {
    return "Webbformulär";
  }

  if (source === "qr" || source === "qr_code") {
    return "QR-kod";
  }

  if (source === "dashboard_manual" || source === "manual") {
    return "Dashboard";
  }

  return source;
}

function toLeadReference(value: unknown) {
  const id = toText(value);

  if (!id) {
    return "PRO-LEAD";
  }

  return `PRO-${id.slice(0, 8).toUpperCase()}`;
}

export type DashboardLead = {
  id: string;
  ref: string;
  customer: string;
  service: string;
  city: string;
  status: "Ny";
  source: string;
  value: string;
  nextStep: string;
  profileHref: string;
  bookingHref: string;
};

export async function getDashboardLeads(): Promise<DashboardLead[]> {
  const sql = getSqlClient();

  if (!sql) {
    return [];
  }

  const workspaceId = await getActiveWorkspaceId();

  try {
    const rows = await sql`
      select
        id,
        name,
        city,
        source,
        primary_service_slug,
        created_at
      from customers
      where workspace_id in (${workspaceId}, ${LEGACY_WORKSPACE_ID})
        and status = 'prospect'
      order by case when workspace_id = ${workspaceId} then 0 else 1 end, created_at desc
      limit 50
    `;

    return rows.map((row) => {
      const id = toText(row.id);

      return {
        id,
        ref: toLeadReference(row.id),
        customer: toText(row.name, "Namnlös kund"),
        service: toText(row.primary_service_slug, "Ej valt"),
        city: toText(row.city, "Okänd ort"),
        status: "Ny",
        source: toLeadSourceLabel(row.source),
        value: "Ej beräknat",
        nextStep: "Kvalificera kund",
        profileHref: `/dashboard/kunder/${id}`,
        bookingHref: `/dashboard/bokningar/ny?customer=${encodeURIComponent(id)}`,
      };
    });
  } catch (error) {
    console.error("Failed to read dashboard leads", error);
    return [];
  }
}
