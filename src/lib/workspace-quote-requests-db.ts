import "server-only";

import { randomUUID } from "node:crypto";

import { neon } from "@neondatabase/serverless";

import type { PublicWorkspaceQuoteInput } from "@/features/workspace-quotes/public-quote";
import {
  canTransitionWorkspaceQuote,
  type WorkspaceQuoteStatus,
} from "@/lib/workspace-quote-policy";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL ??
  process.env.POSTGRES_PRISMA_URL ??
  process.env.POSTGRES_URL_NON_POOLING;

function getSqlClient() {
  return connectionString ? neon(connectionString) : null;
}

async function getActiveWorkspaceId() {
  const access = await getUserWorkspaceAccess();

  if (!access.ok) {
    throw new Error("A valid workspace membership is required for quote requests");
  }

  return access.workspaceId;
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export type DashboardWorkspaceQuoteRequest = {
  id: string;
  referenceId: string;
  status: WorkspaceQuoteStatus;
  serviceId: string | null;
  serviceName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  city: string;
  postalCode: string;
  description: string;
  preferredDate: string;
  source: string;
  createdAt: string;
  updatedAt: string;
};

function mapQuote(row: Record<string, unknown>): DashboardWorkspaceQuoteRequest {
  return {
    id: text(row.id),
    referenceId: text(row.reference_id),
    status: text(row.status) as WorkspaceQuoteStatus,
    serviceId: row.service_id ? text(row.service_id) : null,
    serviceName: text(row.service_name),
    customerName: text(row.customer_name),
    customerEmail: text(row.customer_email),
    customerPhone: text(row.customer_phone),
    city: text(row.city),
    postalCode: text(row.postal_code),
    description: text(row.description),
    preferredDate: text(row.preferred_date),
    source: text(row.source),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

export async function getDashboardWorkspaceQuoteRequests() {
  const sql = getSqlClient();
  if (!sql) return [];

  const workspaceId = await getActiveWorkspaceId();
  const rows = await sql`
    select
      q.id,
      q.reference_id,
      q.status,
      q.service_id,
      coalesce(s.name, '') as service_name,
      q.customer_name,
      q.customer_email,
      q.customer_phone,
      q.city,
      q.postal_code,
      q.description,
      q.preferred_date,
      q.source,
      q.created_at,
      q.updated_at
    from workspace_quote_requests q
    left join workspace_services s
      on s.id = q.service_id
     and s.workspace_id = q.workspace_id::text
    where q.workspace_id = ${workspaceId}
    order by q.created_at desc
  `;

  return rows.map((row) => mapQuote(row as Record<string, unknown>));
}

export async function getDashboardWorkspaceQuoteRequest(id: string) {
  const sql = getSqlClient();
  if (!sql) return null;

  const workspaceId = await getActiveWorkspaceId();
  const rows = await sql`
    select
      q.id,
      q.reference_id,
      q.status,
      q.service_id,
      coalesce(s.name, '') as service_name,
      q.customer_name,
      q.customer_email,
      q.customer_phone,
      q.city,
      q.postal_code,
      q.description,
      q.preferred_date,
      q.source,
      q.created_at,
      q.updated_at
    from workspace_quote_requests q
    left join workspace_services s
      on s.id = q.service_id
     and s.workspace_id = q.workspace_id::text
    where q.workspace_id = ${workspaceId}
      and q.id = ${id}
    limit 1
  `;

  return rows[0] ? mapQuote(rows[0] as Record<string, unknown>) : null;
}

export async function transitionDashboardWorkspaceQuoteRequest(
  id: string,
  nextStatus: WorkspaceQuoteStatus,
) {
  const sql = getSqlClient();
  if (!sql) throw new Error("Missing database connection for quote transition");

  const workspaceId = await getActiveWorkspaceId();
  const currentRows = await sql`
    select status
    from workspace_quote_requests
    where id = ${id} and workspace_id = ${workspaceId}
    limit 1
  `;

  const current = currentRows[0]?.status as WorkspaceQuoteStatus | undefined;
  if (!current) throw new Error("Quote request was not found for the active workspace");
  if (!canTransitionWorkspaceQuote(current, nextStatus)) {
    throw new Error(`Invalid quote transition: ${current} -> ${nextStatus}`);
  }

  const updated = await sql`
    update workspace_quote_requests
    set status = ${nextStatus}, updated_at = now()
    where id = ${id}
      and workspace_id = ${workspaceId}
      and status = ${current}
    returning id
  `;

  if (!updated[0]) throw new Error("Quote request changed before the transition completed");
}

export async function createPublicWorkspaceQuoteRequest(
  workspaceSlug: string,
  input: PublicWorkspaceQuoteInput,
) {
  const sql = getSqlClient();
  if (!sql) throw new Error("Missing database connection for public quote submission");

  const workspaces = await sql`
    select id
    from workspaces
    where slug = ${workspaceSlug}
      and status in ('active', 'trial')
    limit 1
  `;

  const workspaceId = workspaces[0]?.id ? String(workspaces[0].id) : null;
  if (!workspaceId) return { ok: false as const, reason: "workspace" as const };

  let serviceId: string | null = null;
  if (input.serviceId) {
    const services = await sql`
      select id
      from workspace_services
      where id = ${input.serviceId}
        and workspace_id = ${workspaceId}
        and is_active = true
      limit 1
    `;

    if (!services[0]) return { ok: false as const, reason: "service" as const };
    serviceId = input.serviceId;
  }

  const referenceId = `WQ-${randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase()}`;
  const rows = await sql`
    insert into workspace_quote_requests (
      workspace_id,
      service_id,
      reference_id,
      customer_name,
      customer_email,
      customer_phone,
      city,
      postal_code,
      description,
      preferred_date,
      source
    ) values (
      ${workspaceId},
      ${serviceId},
      ${referenceId},
      ${input.name},
      ${input.email.toLowerCase()},
      ${input.phone || null},
      ${input.city || null},
      ${input.postalCode || null},
      ${input.description},
      ${input.preferredDate || null},
      'website'
    )
    returning reference_id
  `;

  if (!rows[0]) throw new Error("Workspace quote request was not created");
  return { ok: true as const, referenceId: String(rows[0].reference_id) };
}
