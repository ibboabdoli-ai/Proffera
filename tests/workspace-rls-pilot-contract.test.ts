import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readRepoFile = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8").toLowerCase();

describe("workspace RLS pilot contract", () => {
  it("keeps the pilot role non-login and unable to bypass RLS", () => {
    const migration = readRepoFile("db/migrations/20260808_0035_customers_rls_pilot.sql");

    expect(migration).not.toContain("do $$");
    expect(migration).toContain("create role proffera_tenant_rls");
    expect(migration).toContain("nologin");
    expect(migration).toContain("nobypassrls");
    expect(migration).toContain("grant select on table public.customers to proffera_tenant_rls");
  });

  it("enables a fail-closed customers policy scoped to app.workspace_id", () => {
    const migration = readRepoFile("db/migrations/20260808_0035_customers_rls_pilot.sql");

    expect(migration).toContain("alter table public.customers enable row level security");
    expect(migration).toContain("alter table public.customers force row level security");
    expect(migration).toContain("create policy customers_workspace_select_rls");
    expect(migration).toContain("for select");
    expect(migration).toContain("to proffera_tenant_rls");
    expect(migration).toContain("current_setting('app.workspace_id', true)");
  });

  it("sets role and workspace context transaction-locally before reading dashboard leads", () => {
    const context = readRepoFile("src/lib/db/workspace-tenant-context.ts");
    const leads = readRepoFile("src/lib/dashboard-leads.ts");

    expect(context).toContain("set local role proffera_tenant_rls");
    expect(context).toContain("set_config('app.workspace_id'");
    expect(context).toContain(", true)");
    expect(context).toContain("uuidpattern.test(workspaceid)");
    expect(leads).toContain("sql.transaction([");
    expect(leads).toContain("...workspacetenantcontextqueries(sql, workspaceid)");
    expect(leads).toContain("from customers");
    expect(leads).toContain("where workspace_id = ${workspaceid}");
  });
});
