import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(), getSql: vi.fn(), fetch: vi.fn(),
}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import { sendWorkspaceTransactionalSms } from "./workspace-sms-dispatch";

const context = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  deliveryKey: "booking:synthetic-001:reminder",
  customerPhone: "+46700000000",
  content: "Din bokning är bekräftad.",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("BREVO_API_KEY", "synthetic-key");
  vi.stubEnv("BREVO_SMS_SENDER", "Proffera");
  mocks.getSql.mockReturnValue(mocks.query);
  mocks.query.mockImplementation(async (parts: TemplateStringsArray) => {
    const sql = parts.join("?").toLowerCase();
    if (sql.includes("from workspaces w")) return [{
      slug: "makeup-by-maria", plan_key: "starter", billing_status: "active",
    }];
    if (sql.includes("reserve_workspace_starter_sms")) return [{ result: "reserved" }];
    if (sql.includes("update workspace_sms_dispatches")) return [];
    throw Error("Unexpected SMS query");
  });
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.fetch.mockResolvedValue(new Response(JSON.stringify({ messageId: 1337 }), { status: 201 }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("Starter SMS provider dispatch and reservation safety", () => {
  it("always blocks Preview SMS before accessing database or Brevo", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(await sendWorkspaceTransactionalSms(context)).toMatchObject({ ok: false, skipped: true });
    expect(mocks.getSql).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("does not reserve or send Starter SMS for an unrelated paid workspace", async () => {
    mocks.query.mockImplementation(async (parts: TemplateStringsArray) => {
      const sql = parts.join("?").toLowerCase();
      if (sql.includes("from workspaces w")) return [{
        slug: "other-workspace", plan_key: "starter", billing_status: "active",
        plan_status: "active", sms_enabled: true, stripe_subscription_id: "sub_qa",
      }];
      throw Error("A non-Maria Starter must not reach the reservation function");
    });
    expect(await sendWorkspaceTransactionalSms(context)).toMatchObject({ ok:false });
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("reserves units before sending and journals confirmed provider acceptance", async () => {
    expect(await sendWorkspaceTransactionalSms(context)).toEqual({
      ok: true, skipped: false, providerId: "1337",
    });
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    const calls=mocks.query.mock.calls.map(([parts]) => (parts as TemplateStringsArray).join("?"));
    expect(calls[1]).toContain("reserve_workspace_starter_sms");
    expect(calls[2]).toContain("update workspace_sms_dispatches");
    expect(mocks.fetch.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.query.mock.invocationCallOrder[1]!);
  });

  it("blocks exhausted or duplicate quotas without contacting Brevo", async () => {
    mocks.query.mockImplementation(async (parts: TemplateStringsArray) => {
      const sql=parts.join("?");
      return sql.includes("from workspaces w")
        ? [{ slug: "makeup-by-maria", plan_key: "starter" }]
        : [{ result: "quota_exhausted" }];
    });
    expect(await sendWorkspaceTransactionalSms(context)).toMatchObject({ ok: false, skipped: true });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("retains an uncertain quota claim on provider timeout or 503", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("synthetic timeout"));
    expect(await sendWorkspaceTransactionalSms(context)).toMatchObject({ ok: false, skipped: false });
    const calls=mocks.query.mock.calls.map(([parts])=>(parts as TemplateStringsArray).join("?"));
    expect(calls.some(s=>s.includes("update workspace_sms_dispatches"))).toBe(true);
  });

  it("refuses invalid workspace identity before contacting Brevo", async () => {
    expect(await sendWorkspaceTransactionalSms({ ...context, workspaceId: "../other" }))
      .toMatchObject({ ok: false, skipped: true });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("returns an explicit skip when the SMS provider is not configured", async () => {
    vi.stubEnv("BREVO_SMS_SENDER", "");
    expect(await sendWorkspaceTransactionalSms(context)).toMatchObject({ ok: false, skipped: true });
    expect(mocks.getSql).not.toHaveBeenCalled();
  });
});
