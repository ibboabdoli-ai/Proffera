import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { getSql } from "@/lib/db/server";
import { getPlatformAdmin } from "@/lib/platform-admin";
import { isWorkspaceFeatureKey } from "@/lib/workspace-feature-catalog";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function redirectToWorkspace(request: Request, workspaceId: string, status: string) {
  const url = new URL(`/admin/workspaces/${encodeURIComponent(workspaceId)}`, request.url);
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
  const enabledValue = String(formData.get("enabled") ?? "");

  if (admin.role !== "super_admin") {
    return redirectToWorkspace(request, workspaceId, "forbidden");
  }

  if (requestOrigin && requestOrigin !== requestUrl.origin) {
    return redirectToWorkspace(request, workspaceId, "forbidden");
  }

  if (!uuidPattern.test(workspaceId) || !isWorkspaceFeatureKey(featureKey)) {
    return redirectToWorkspace(request, workspaceId, "invalid");
  }

  if (enabledValue !== "true" && enabledValue !== "false") {
    return redirectToWorkspace(request, workspaceId, "invalid");
  }

  const enabled = enabledValue === "true";
  const sql = getSql();
  if (!sql) return redirectToWorkspace(request, workspaceId, "database");

  const workspaceRows = await sql`
    select w.id,
      coalesce(f.enabled, false) as enabled
    from workspaces w
    left join workspace_feature_flags f
      on f.workspace_id = w.id and f.feature_key = ${featureKey}
    where w.id = ${workspaceId}::uuid
    limit 1
  `;
  const workspace = workspaceRows[0];
  if (!workspace) return redirectToWorkspace(request, workspaceId, "missing");

  const previousEnabled = Boolean(workspace.enabled);
  if (previousEnabled === enabled) {
    return redirectToWorkspace(request, workspaceId, "unchanged");
  }

  await sql.transaction((tx) => [
    tx`
      insert into workspace_feature_flags (
        id, workspace_id, feature_key, enabled, created_at, updated_at
      ) values (
        gen_random_uuid(), ${workspaceId}::uuid, ${featureKey}, ${enabled}::boolean, now(), now()
      )
      on conflict (workspace_id, feature_key)
      do update set enabled = excluded.enabled, updated_at = now()
    `,
    tx`
      insert into admin_audit_logs (
        admin_user_id, workspace_id, action, reason, previous_value, new_value
      ) values (
        ${admin.userId},
        ${workspaceId}::uuid,
        'workspace.feature_access_changed',
        ${`Feature ${featureKey} changed manually from Platform Admin`},
        ${JSON.stringify({ feature_key: featureKey, enabled: previousEnabled })}::jsonb,
        ${JSON.stringify({ feature_key: featureKey, enabled })}::jsonb
      )
    `,
  ]);

  revalidatePath(`/admin/workspaces/${workspaceId}`);
  revalidatePath("/admin/workspaces");
  revalidatePath("/dashboard");

  return redirectToWorkspace(request, workspaceId, enabled ? "enabled" : "disabled");
}
