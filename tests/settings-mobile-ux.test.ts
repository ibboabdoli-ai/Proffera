import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Settings mobile UX", () => {
  it("applies a Settings-only responsive layer alongside the shared workspace design system", () => {
    const layout = source("src/app/dashboard/installningar/layout.tsx");
    const css = source("src/components/dashboard/settings-mobile-ux.module.css");

    expect(layout).toContain("secondary-workspace-ux-2.module.css");
    expect(layout).toContain("settings-mobile-ux.module.css");
    expect(layout).toContain("mobileStyles.scope");
    expect(layout).toContain("data-settings-nav-panel");
    expect(layout).toContain("data-settings-nav");
    expect(css).toContain("@media (max-width: 639px)");
    expect(css).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
  });

  it("keeps narrow forms, controls and long workspace content inside the phone viewport", () => {
    const css = source("src/components/dashboard/settings-mobile-ux.module.css");

    expect(css).toContain('input[type="time"]');
    expect(css).toContain("grid-template-columns: minmax(0, 1fr) !important");
    expect(css).toContain(":where(form) button");
    expect(css).toContain(':where([class~="truncate"])');
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain(":where(dl) dd");
  });

  it("preserves Settings permissions and all sensitive mutation boundaries", () => {
    const page = source("src/app/dashboard/installningar/page.tsx");

    expect(page).toContain("getUserWorkspaceAccess");
    expect(page).toContain("canManageWorkspaceSettings");
    expect(page).toContain("canManageWorkspaceMembers");
    expect(page).toContain("updateWorkspaceSettingsAction");
    expect(page).toContain("updateWorkspaceBookingHoursAction");
    expect(page).toContain("WorkspaceMembersCard");
    expect(page).toContain("WorkspaceBillingCard");
    expect(page).toContain("BookingLinkCard");
  });
});
