import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => ({ getSql: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import { hasActivePaidDirectoryContactAccess } from "@/lib/company-directory-paid-contact-entitlement";

const workspaceId = "11111111-1111-4111-8111-111111111111";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("paid Directory contact access", () => {
  beforeEach(() => mocks.getSql.mockReset());

  it("keeps Trial locked even when the trial has a Starter plan key", async () => {
    mocks.getSql.mockReturnValue(vi.fn(async () => [{
      plan_key: "starter",
      status: "trialing",
      current_period_end: "2099-01-01T00:00:00.000Z",
    }]));

    await expect(hasActivePaidDirectoryContactAccess(workspaceId)).resolves.toBe(false);
  });

  it("unlocks Starter or higher only when plan status is active", async () => {
    mocks.getSql.mockReturnValue(vi.fn(async () => [{
      plan_key: "starter",
      status: "active",
      current_period_end: null,
    }]));

    await expect(hasActivePaidDirectoryContactAccess(workspaceId)).resolves.toBe(true);
  });

  it("fails closed when plan lookup fails", async () => {
    mocks.getSql.mockReturnValue(vi.fn(async () => { throw new Error("db unavailable"); }));
    await expect(hasActivePaidDirectoryContactAccess(workspaceId)).resolves.toBe(false);
  });
});

describe("super-admin Directory contact visibility", () => {
  it("loads raw SCB and profile contact values without public plan gating", () => {
    const admin = source("src/lib/company-directory-admin.ts");
    expect(admin).toContain("await requireSuperAdmin()");
    expect(admin).toContain("scb.phone as scb_phone");
    expect(admin).toContain("scb.email as scb_email");
    expect(admin).toContain("p.address_line1, p.postal_code, p.website_url");
    expect(admin).toContain("Admin · Telefon:");
    expect(admin).toContain("Admin · E-post:");
    expect(admin).toContain("Admin · Webbplats:");
    expect(admin).toContain("Admin · Adress:");
    expect(admin).not.toContain("hasActivePaidDirectoryContactAccess");
  });
});
