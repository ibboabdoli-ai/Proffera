import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/components/dashboard/dashboard-module-guard", () => ({
  DashboardModuleGuard: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "module-locked" }, children),
}));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: vi.fn(),
  canManageWorkspaceSettings: vi.fn(),
}));
vi.mock("@/lib/maria-production-activation-policy", () => ({
  isMariaProductionExistingBookingLifecycleAuthorized: vi.fn(),
}));

import { getUserWorkspaceAccess, canManageWorkspaceSettings } from "@/lib/workspace-access";
import { isMariaProductionExistingBookingLifecycleAuthorized } from "@/lib/maria-production-activation-policy";
import BookingsLayout from "./layout";

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getUserWorkspaceAccess).mockResolvedValue({
    ok: true, workspaceSlug: "makeup-by-maria",
  } as Awaited<ReturnType<typeof getUserWorkspaceAccess>>);
  vi.mocked(canManageWorkspaceSettings).mockReturnValue(true);
  vi.mocked(isMariaProductionExistingBookingLifecycleAuthorized).mockReturnValue(true);
});
afterEach(() => vi.unstubAllEnvs());

describe("Maria existing booking manager access", () => {
  it("keeps existing bookings accessible when new intake is not entitled", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const html = renderToStaticMarkup(await BookingsLayout({
      children: createElement("span", null, "Existing booking"),
    }));
    expect(html).toContain("Existing booking");
    expect(html).not.toContain("data-testid");
  });

  it("keeps all other workspaces behind the normal booking module gate", async () => {
    vi.mocked(getUserWorkspaceAccess).mockResolvedValue({
      ok: true, workspaceSlug: "another-business",
    } as Awaited<ReturnType<typeof getUserWorkspaceAccess>>);
    const html = renderToStaticMarkup(await BookingsLayout({
      children: createElement("span", null, "Tenant booking"),
    }));
    expect(html).toContain('data-testid="module-locked"');
  });

  it("requires manager permissions and independent lifecycle activation", async () => {
    vi.mocked(canManageWorkspaceSettings).mockReturnValue(false);
    let html = renderToStaticMarkup(await BookingsLayout({ children: createElement("span", null, "Bookings") }));
    expect(html).toContain('data-testid="module-locked"');
    vi.mocked(canManageWorkspaceSettings).mockReturnValue(true);
    vi.mocked(isMariaProductionExistingBookingLifecycleAuthorized).mockReturnValue(false);
    html = renderToStaticMarkup(await BookingsLayout({ children: createElement("span", null, "Bookings") }));
    expect(html).toContain('data-testid="module-locked"');
  });
});
