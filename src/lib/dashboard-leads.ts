import "server-only";

import { neon } from "@neondatabase/serverless";

import { resolveDatabaseUrl } from "@/lib/db/database-url";
import { workspaceTenantContextQueries } from "@/lib/db/workspace-tenant-context";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString = resolveDatabaseUrl();

function getSqlClient() {
  if (!connectionString) return null;
  return neon(connectionString);
}

async function getActiveWorkspaceId() {
  const access = await getUserWorkspaceAccess();
  if (!access.ok) throw new Error("A valid workspace membership is required for dashboard leads");
  return access.workspaceId;
}

function toText(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function toLeadSourceLabel(value: unknown) {
  const source = toText(value, "dashboard_manual");
  if (source === "service_ai_chat" || source === "ai_chat") return "AI-chatt";
  if (source === "web_form" || source === "webbformular") return "Webbformulär";
  if (source === "qr" || source === "qr_code") return "QR-kod";
  if (source === "dashboard_manual" || source === "manual") return "Dashboard";
  return source;
}

function toLeadReference(value: unknown) {
  const id = toText(value);
  if (!id) return "PRO-LEAD";
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
  if (!sql) return [];

  const workspaceId = await getActiveWorkspaceId();
  try {
    const [, , rows] = await sql.transaction([
      ...workspaceTenantContextQueries(sql, workspaceId),
      sql`
        select
          customer.id,
          customer.name,
          customer.city,
          customer.source,
          coalesce(service.name, customer.primary_service_slug) as primary_service_slug,
          customer.created_at
        from customers customer
        left join workspace_services service
          on service.workspace_id = customer.workspace_id
         and service.public_slug = customer.primary_service_slug
        where customer.workspace_id = ${workspaceId}
          and customer.status = 'prospect'
        order by customer.created_at desc
        limit 50
      `,
    ]);

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
