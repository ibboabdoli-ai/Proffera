import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getSql } from "@/lib/db/server";
import { getPlatformAdmin } from "@/lib/platform-admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedModes = new Set(["enable", "disable", "plan"]);

function redirectToWorkspace(request: Request, workspaceId: string, status: string) {
  const safeWorkspaceId = uuidPattern.test(workspaceId) ? workspaceId : "";
  const pathname = safeWorkspaceId
    ? `/admin/workspaces/${encodeURIComponent(safeWorkspaceId)}`
    : "/admin/workspaces";
  const url = new URL(pathname, request.url);
  url.searchParams.set("feature", status);
  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  const admin = await getPlatformAdmin();
  const requestUrl = new URL(request.url);
  const requestOrigin = request.headers.get("origin");

  if (!admin) return NextResponse.redirect(new URL("/logga-in", request.url));

  const formData = await request.formData();
  const workspaceId = String(formData.get("workspace_id") ?? "");
  const featureKey = String(formData.get("feature_key") ?? "");
  const mode = String(formData.get("mode") ?? "");

  if (admin.role !== "super_admin") {
    return redirectToWorkspace(request, workspaceId, "forbidden");
  }

  if (requestOrigin && requestOrigin !== requestUrl.origin) {
    return redirectToWorkspace(request, workspaceId, "forbidden");
  }

  if (!uuidPattern.test(workspaceId) || !featureKey || !allowedModes.has(mode)) {
    return redirectToWorkspace(request, workspaceId, "invalid");
  }

  const sql = getSql();
  if (!sql) return redirectToWorkspace(request, workspaceId, "database");

  const rows = await sql`
    select
      w.id,
      c.feature_key,
      o.enabled as override_enabled,
      (o.workspace_id is not null) as has_override
    from workspaces w
    join feature_catalog c
      on c.feature_key = ${featureKey}::text and c.is_active = true
    left join workspace_feature_overrides o
      on o.workspace_id = w.id and o.feature_key = c.feature_key
    where w.id = ${workspaceId}::uuid
    limit 1
  `;
  const current = rows[0];
  if (!current) return redirectToWorkspace(request, workspaceId, "missing");

  const hasOverride = Boolean(current.has_override);
  const previousOverride = hasOverride ? Boolean(current.override_enabled) : null;

  if (mode === "plan") {
    if (!hasOverride) return redirectToWorkspace(request, workspaceId, "unchanged");

    await sql.transaction((tx) => [
      tx`
        delete from workspace_feature_overrides
        where workspace_id = ${workspaceId}::uuid and feature_key = ${featureKey}::text
      `,
      tx`
        insert into admin_audit_logs (
          admin_user_id, workspace_id, action, reason, previous_value, new_value
        ) values (
          ${admin.userId},
          ${workspaceId}::uuid,
          'workspace.feature_override_cleared',
          ${`Feature ${featureKey} returned to plan-controlled access from Platform Admin`},
          ${JSON.stringify({ feature_key: featureKey, admin_override_enabled: previousOverride })}::jsonb,
          ${JSON.stringify({ feature_key: featureKey, admin_override_enabled: null })}::jsonb
        )
      `,
    ]);

    revalidatePath(`/admin/workspaces/${workspaceId}`);
    revalidatePath("/admin/workspaces");
    revalidatePath("/dashboard");
    return redirectToWorkspace(request, workspaceId, "plan");
  }

  const enabled = mode === "enable";
  if (previousOverride === enabled) {
    return redirectToWorkspace(request, workspaceId, "unchanged");
  }

  const reason = `Feature ${featureKey} ${enabled ? "enabled" : "disabled"} manually from Platform Admin`;
  await sql.transaction((tx) => [
    tx`
      insert into workspace_feature_overrides (
        workspace_id, feature_key, enabled, reason, created_by, created_at, updated_at
      ) values (
        ${workspaceId}::uuid,
        ${featureKey}::text,
        ${enabled}::boolean,
        ${reason},
        ${admin.userId},
        now(),
        now()
      )
      on conflict (workspace_id, feature_key)
      do update set
        enabled = excluded.enabled,
        reason = excluded.reason,
        created_by = excluded.created_by,
        updated_at = now()
    `,
    tx`
      insert into admin_audit_logs (
        admin_user_id, workspace_id, action, reason, previous_value, new_value
      ) values (
        ${admin.userId},
        ${workspaceId}::uuid,
        'workspace.feature_override_changed',
        ${reason},
        ${JSON.stringify({ feature_key: featureKey, admin_override_enabled: previousOverride })}::jsonb,
        ${JSON.stringify({ feature_key: featureKey, admin_override_enabled: enabled })}::jsonb
      )
    `,
  ]);

  revalidatePath(`/admin/workspaces/${workspaceId}`);
  revalidatePath("/admin/workspaces");
  revalidatePath("/dashboard");

  return redirectToWorkspace(request, workspaceId, enabled ? "enabled" : "disabled");
}
