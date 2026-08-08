import "server-only";

import type { NeonQueryFunction } from "@neondatabase/serverless";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type SqlClient = NeonQueryFunction<false, false>;

export const WORKSPACE_RLS_ROLE = "proffera_tenant_rls";

export function workspaceTenantContextQueries(sql: SqlClient, workspaceId: string) {
  if (!uuidPattern.test(workspaceId)) {
    throw new Error("Invalid workspace context for tenant-scoped database transaction");
  }

  return [
    sql`set local role proffera_tenant_rls`,
    sql`select set_config('app.workspace_id', ${workspaceId}, true)`,
  ] as const;
}
