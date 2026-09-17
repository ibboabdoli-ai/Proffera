import { beforeEach, describe, expect, it, vi } from "vitest";

type QueryToken = {
  text: string;
  values: unknown[];
};

type CustomerRow = Record<string, unknown> & {
  workspace_id: string;
  status: string;
  created_at: string;
};

const workspaceA = "11111111-1111-4111-8111-111111111111";
const workspaceB = "22222222-2222-4222-8222-222222222222";

const state = vi.hoisted(() => ({
  access: {
    ok: true,
    userId: "user-a",
    workspaceId: "11111111-1111-4111-8111-111111111111",
    workspaceSlug: "workspace-a",
    workspaceName: "Workspace A",
    workspaceStatus: "active",
    role: "owner",
  } as Record<string, unknown>,
  customers: [] as CustomerRow[],
  queries: [] as QueryToken[],
  transactionError: null as Error | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/database-url", () => ({ resolveDatabaseUrl: () => "postgres://dashboard-leads.test/local" }));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: vi.fn(async () => state.access),
}));
vi.mock("@neondatabase/serverless", () => ({
  neon: vi.fn(() => {
    const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => ({
      text: strings.join("?"),
      values,
    })) as ((strings: TemplateStringsArray, ...values: unknown[]) => QueryToken) & {
      transaction: (queries: QueryToken[]) => Promise<unknown[][]>;
    };

    sql.transaction = vi.fn(async (queries: QueryToken[]) => {
      state.queries = queries;
      if (state.transactionError) throw state.transactionError;

      const customerQuery = queries.find((query) => query.text.includes("from customers"));
      const workspaceId = String(customerQuery?.values[0] ?? "");
      const rows = state.customers
        .filter((customer) => customer.workspace_id === workspaceId && customer.status === "prospect")
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .slice(0, 50);

      return [[], [], rows];
    });

    return sql;
  }),
}));

import { getDashboardLeads } from "@/lib/dashboard-leads";

function customer(overrides: Partial<CustomerRow> = {}): CustomerRow {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    workspace_id: workspaceA,
    name: "Anna Andersson",
    city: "Södertälje",
    source: "web_form",
    primary_service_slug: "fonsterputs",
    status: "prospect",
    created_at: "2026-09-13T08:00:00.000Z",
    ...overrides,
  };
}

describe("Dashboard Leads tenant-scoped read", () => {
  beforeEach(() => {
    state.access = {
      ok: true,
      userId: "user-a",
      workspaceId: workspaceA,
      workspaceSlug: "workspace-a",
      workspaceName: "Workspace A",
      workspaceStatus: "active",
      role: "owner",
    };
    state.customers = [];
    state.queries = [];
    state.transactionError = null;
    vi.clearAllMocks();
  });

  it("loads only the active Workspace's prospect Leads", async () => {
    state.customers = [
      customer(),
      customer({
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        workspace_id: workspaceB,
        name: "Workspace B Lead",
        primary_service_slug: "fonsterputs",
      }),
      customer({
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        name: "Existing Customer",
        status: "active",
      }),
    ];

    const leads = await getDashboardLeads();

    expect(leads).toHaveLength(1);
    expect(leads[0]).toMatchObject({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      customer: "Anna Andersson",
      service: "fonsterputs",
      city: "Södertälje",
      source: "Webbformulär",
      status: "Ny",
    });
    expect(leads.some((lead) => lead.customer === "Workspace B Lead")).toBe(false);
  });

  it("does not query or expose service metadata from another Workspace", async () => {
    state.customers = [customer({ primary_service_slug: "shared-service-slug" })];

    const leads = await getDashboardLeads();
    const queryText = state.queries.map((query) => query.text).join("\n").toLowerCase();

    expect(leads[0]?.service).toBe("shared-service-slug");
    expect(queryText).toContain("from customers");
    expect(queryText).not.toContain("workspace_services");
    expect(queryText).not.toContain(" join ");
  });

  it("propagates database permission failures instead of presenting an empty inbox", async () => {
    state.transactionError = new Error("permission denied for table workspace_services");

    await expect(getDashboardLeads()).rejects.toThrow("permission denied for table workspace_services");
  });

  it("fails closed when the user has no valid Workspace membership", async () => {
    state.access = { ok: false, reason: "no_membership" };

    await expect(getDashboardLeads()).rejects.toThrow("A valid workspace membership is required");
    expect(state.queries).toEqual([]);
  });

  it("fails closed before querying when the resolved Workspace ID is invalid", async () => {
    state.access = { ...state.access, workspaceId: "../../workspace-b" };

    await expect(getDashboardLeads()).rejects.toThrow("Invalid workspace context");
    expect(state.queries).toEqual([]);
  });

  it("returns an empty list for a legitimate empty Workspace result", async () => {
    await expect(getDashboardLeads()).resolves.toEqual([]);
    expect(state.queries.some((query) => query.text.includes("from customers"))).toBe(true);
  });
});
