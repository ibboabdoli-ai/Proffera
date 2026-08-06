import { NextResponse } from "next/server";

import { createWorkspaceInvitation } from "@/features/company/workspace-invitation";
import { getCompanyAdmin } from "@/lib/admin-authorization";
import { getSql } from "@/lib/db/server";

const allowedStatuses = ["pending", "approved", "rejected", "paused"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isAllowedStatus(value: string) {
  return allowedStatuses.includes(value as (typeof allowedStatuses)[number]);
}

function redirectToCompanyAdmin(request: Request, key?: string, value?: string) {
  const url = new URL("/admin/foretag", request.url);
  if (key && value) url.searchParams.set(key, value);
  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  const admin = await getCompanyAdmin();
  const requestUrl = new URL(request.url);
  const requestOrigin = request.headers.get("origin");

  if (!admin || (requestOrigin && requestOrigin !== requestUrl.origin)) {
    return redirectToCompanyAdmin(request, "access", "forbidden");
  }

  const formData = await request.formData();
  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");
  const status = String(formData.get("status") ?? "");
  const services = String(formData.get("services") ?? "");
  const sql = getSql();

  if (!sql) return redirectToCompanyAdmin(request, "access", "database");

  if (action === "workspace_access") {
    const workspaceId = String(formData.get("workspace_id") ?? "");
    const requestedPlanKey = String(formData.get("plan_key") ?? "");
    const requestedPlanStatus = String(formData.get("plan_status") ?? "");

    if (!uuidPattern.test(workspaceId)) {
      return redirectToCompanyAdmin(request, "access", "invalid");
    }

    const currentRows = await sql`
      select coalesce(p.plan_key, 'none') as plan_key, coalesce(p.status, 'none') as plan_status
      from workspaces w
      left join lateral (
        select plan_key, status
        from workspace_plans
        where workspace_id = w.id
        order by created_at desc
        limit 1
      ) p on true
      where w.id = ${workspaceId}::uuid
      limit 1
    `;
    const current = currentRows[0];

    await sql`
      insert into admin_audit_logs (
        admin_user_id, workspace_id, action, reason, previous_value, new_value
      ) values (
        ${admin.userId},
        ${workspaceId}::uuid,
        'billing.manual_change_blocked',
        'Manual plan or subscription status changes are blocked because Stripe is the source of truth',
        ${JSON.stringify({
          plan_key: current?.plan_key ?? null,
          status: current?.plan_status ?? null,
        })}::jsonb,
        ${JSON.stringify({
          blocked: true,
          requested_plan_key: requestedPlanKey || null,
          requested_status: requestedPlanStatus || null,
        })}::jsonb
      )
    `;
    return redirectToCompanyAdmin(request, "access", "read_only");
  }

  if (!uuidPattern.test(id)) return redirectToCompanyAdmin(request, "access", "invalid");

  if (action === "invite") {
    const beforeRows = await sql`
      select cr.id, cr.company_name, cr.email, cr.status,
             wi.status as invitation_status, wi.expires_at
      from company_registrations cr
      left join workspace_invitations wi on wi.company_registration_id = cr.id
      where cr.id = ${id}::uuid
      limit 1
    `;
    const result = await createWorkspaceInvitation(id, requestUrl.origin);

    await sql`
      insert into admin_audit_logs (
        admin_user_id, action, reason, previous_value, new_value
      ) values (
        ${admin.userId},
        'company.invitation_requested',
        ${`Workspace invitation requested for company registration ${id}`},
        ${JSON.stringify(beforeRows[0] ?? null)}::jsonb,
        ${JSON.stringify({ registration_id: id, result: result.ok ? "sent" : result.code })}::jsonb
      )
    `;
    return redirectToCompanyAdmin(request, "invite", result.ok ? "sent" : result.code);
  }

  const previousRows = await sql`
    select id, status, services
    from company_registrations
    where id = ${id}::uuid
    limit 1
  `;
  const previous = previousRows[0];
  if (!previous) return redirectToCompanyAdmin(request, "access", "missing");

  const nextStatus = isAllowedStatus(status) ? status : String(previous.status);
  const cleanServices = services.trim();
  const nextServices = cleanServices.length > 0 && cleanServices.length <= 300
    ? cleanServices
    : String(previous.services ?? "");

  if (nextStatus === String(previous.status) && nextServices === String(previous.services ?? "")) {
    return redirectToCompanyAdmin(request);
  }

  await sql.transaction((tx) => [
    tx`
      update company_registrations
      set status = ${nextStatus}, services = ${nextServices}, updated_at = now()
      where id = ${id}::uuid
    `,
    tx`
      insert into admin_audit_logs (
        admin_user_id, action, reason, previous_value, new_value
      ) values (
        ${admin.userId},
        'company.registration_updated',
        ${`Company registration ${id} updated from Company Admin`},
        ${JSON.stringify({
          registration_id: id,
          status: previous.status,
          services: previous.services,
        })}::jsonb,
        ${JSON.stringify({
          registration_id: id,
          status: nextStatus,
          services: nextServices,
        })}::jsonb
      )
    `,
  ]);

  return redirectToCompanyAdmin(request);
}
