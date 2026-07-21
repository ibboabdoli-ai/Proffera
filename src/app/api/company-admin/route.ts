import { NextResponse } from "next/server";
import { getSql } from "@/lib/db/server";
import { createWorkspaceInvitation } from "@/features/company/workspace-invitation";

const allowedStatuses = ["pending", "approved", "rejected", "paused"] as const;
const allowedPlanKeys = ["starter", "professional", "business"] as const;
const allowedPlanStatuses = ["trialing", "active", "past_due", "cancelled", "paused"] as const;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isAllowedStatus(value: string) {
  return allowedStatuses.includes(value as (typeof allowedStatuses)[number]);
}

function isAllowedPlanKey(value: string) {
  return allowedPlanKeys.includes(value as (typeof allowedPlanKeys)[number]);
}

function isAllowedPlanStatus(value: string) {
  return allowedPlanStatuses.includes(value as (typeof allowedPlanStatuses)[number]);
}

function hasAdminAccess(request: Request) {
  const expectedCode = (process.env.ADMIN_ACCESS_CODE ?? "").trim();
  const authorization = request.headers.get("authorization") ?? "";

  if (!expectedCode || !authorization.startsWith("Basic ")) {
    return false;
  }

  try {
    const decoded = atob(authorization.slice(6));
    const separatorIndex = decoded.indexOf(":");
    return separatorIndex >= 0 && decoded.slice(separatorIndex + 1) === expectedCode;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const requestUrl = new URL(request.url);
  const requestOrigin = request.headers.get("origin");

  if (!hasAdminAccess(request) || (requestOrigin && requestOrigin !== requestUrl.origin)) {
    return NextResponse.redirect(new URL("/admin/foretag", request.url));
  }

  const id = String(formData.get("id") ?? "");
  const action = String(formData.get("action") ?? "");
  const status = String(formData.get("status") ?? "");
  const services = String(formData.get("services") ?? "");
  const sql = getSql();

  if (action === "workspace_access") {
    const workspaceId = String(formData.get("workspace_id") ?? "");
    const planKey = String(formData.get("plan_key") ?? "");
    const planStatus = String(formData.get("plan_status") ?? "");
    const bookingEnabled = formData.get("booking_enabled") === "on";
    const leadsEnabled = formData.get("leads_enabled") === "on";
    const crmEnabled = formData.get("crm_enabled") === "on";
    const url = new URL("/admin/foretag", request.url);

    if (!sql || !uuidPattern.test(workspaceId) || !isAllowedPlanKey(planKey) || !isAllowedPlanStatus(planStatus)) {
      url.searchParams.set("access", "invalid");
      return NextResponse.redirect(url);
    }

    try {
      const rows = await sql`
        with selected_workspace as (
          select id from workspaces where id = ${workspaceId}::uuid
        ),
        latest_plan as (
          select wp.id
          from workspace_plans wp
          join selected_workspace sw on sw.id = wp.workspace_id
          order by wp.created_at desc
          limit 1
        ),
        updated_plan as (
          update workspace_plans wp
          set plan_key = ${planKey}, status = ${planStatus}, updated_at = now()
          from latest_plan lp
          where wp.id = lp.id
          returning wp.id
        ),
        inserted_plan as (
          insert into workspace_plans (id, workspace_id, plan_key, status, current_period_start, created_at, updated_at)
          select gen_random_uuid(), sw.id, ${planKey}, ${planStatus}, now(), now(), now()
          from selected_workspace sw
          where not exists (select 1 from updated_plan)
          returning id
        ),
        feature_values (feature_key, enabled) as (
          values
            ('booking_demo', ${bookingEnabled}),
            ('crm_customers', ${crmEnabled}),
            ('lead_inbox', ${leadsEnabled})
        )
        insert into workspace_feature_flags (id, workspace_id, feature_key, enabled, created_at, updated_at)
        select gen_random_uuid(), sw.id, fv.feature_key, fv.enabled, now(), now()
        from selected_workspace sw
        cross join feature_values fv
        on conflict (workspace_id, feature_key)
        do update set enabled = excluded.enabled, updated_at = now()
        returning workspace_id
      `;

      url.searchParams.set("access", rows.length > 0 ? "updated" : "missing");
    } catch (error) {
      console.error("Failed to update workspace plan and module access", error);
      url.searchParams.set("access", "error");
    }

    return NextResponse.redirect(url);
  }

  if (action === "invite" && id) {
    const result = await createWorkspaceInvitation(id, new URL(request.url).origin);
    const url = new URL("/admin/foretag", request.url);
    url.searchParams.set("invite", result.ok ? "sent" : result.code);
    return NextResponse.redirect(url);
  }

  if (sql && id) {
    if (isAllowedStatus(status)) {
      await sql`
        update company_registrations
        set status = ${status}, updated_at = now()
        where id = ${id}
      `;
    }

    if (services.trim().length > 0 && services.length <= 300) {
      await sql`
        update company_registrations
        set services = ${services}, updated_at = now()
        where id = ${id}
      `;
    }
  }

  return NextResponse.redirect(new URL("/admin/foretag", request.url));
}
