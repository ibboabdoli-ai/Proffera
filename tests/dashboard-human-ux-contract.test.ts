import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("dashboard human-designed UX contract", () => {
  it("keeps the dashboard home dense and operational instead of card-grid heavy", () => {
    const page = source("src/app/dashboard/page.tsx");

    expect(page).toContain("getDashboardModuleAccess()");
    expect(page).toContain("getDashboardEnabledFeatureKeys()");
    expect(page).toContain("getUserWorkspaceAccess()");
    expect(page).toContain("getDashboardStats({ includeCustomers: canUseCrm, includeBookings: canUseBooking })");
    expect(page).toContain("grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-4");
    expect(page).not.toContain("sm:divide-x sm:divide-y-0");
    expect(page).toContain("bg-brand-deep");
    expect(page).toContain("rounded-panel");
    expect(page).not.toContain("absolute -right-24 -top-28");
    expect(page).not.toContain("blur-3xl");
  });

  it("uses a restrained navy workspace shell while preserving mobile menu behavior", () => {
    const shell = source("src/components/dashboard/dashboard-shell.tsx");

    expect(shell).toContain('bg-[#0a2e63]');
    expect(shell).toContain('bg-[#f5f7fa]');
    expect(shell).toContain('"--pf-brand": "#1469d8"');
    expect(shell).toContain('"--pf-brand-deep": "#0a2e63"');
    expect(shell).toContain("dashboard-mobile-menu");
    expect(shell).toContain("env(safe-area-inset-top)");
    expect(shell).toContain("handleMobileMenuKeydown");
    expect(shell).toContain("switchWorkspaceAction");
  });

  it("reduces card fragmentation across CRM, Bookings, and Settings", () => {
    const customers = source("src/app/dashboard/kunder/page.tsx");
    const bookings = source("src/app/dashboard/bokningar/page.tsx");
    const settings = source("src/app/dashboard/installningar/page.tsx");
    const shared = source("src/components/dashboard/dashboard-page-ui.tsx");

    expect(shared).toContain("grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-4");
    expect(shared).not.toContain('aria-label="Sidöversikt"');
    expect(customers).toContain("md:divide-x");
    expect(bookings).toContain("md:divide-x");
    expect(settings).toContain("Status för konfiguration");
    expect(settings).toContain("divide-y divide-line");
    expect(settings).toContain("<dl");
  });
});
