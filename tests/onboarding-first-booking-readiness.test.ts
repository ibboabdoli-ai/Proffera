import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("First booking onboarding", () => {
  it("focuses onboarding on the three conditions required for a usable booking page", () => {
    const code = source("src/app/dashboard/onboarding/page.tsx");

    expect(code).toContain("Din bokningssida på under 5 minuter");
    expect(code).toContain("Bransch och tjänster");
    expect(code).toContain("Bokningstider");
    expect(code).toContain("Dela bokningssidan");
    expect(code).not.toContain('const steps = ["company", "industry", "theme", "services", "hours", "staff", "booking", "chatbot", "publish"]');
  });

  it("derives readiness from live workspace services, booking hours, entitlement and public slug", () => {
    const code = source("src/app/dashboard/onboarding/page.tsx");

    expect(code).toContain("getDashboardWorkspaceServices()");
    expect(code).toContain("getDashboardWorkspaceBookingHours()");
    expect(code).toContain("getDashboardWorkspaceSettings()");
    expect(code).toContain("getDashboardModuleAccess()");
    expect(code).toContain('module.id === "online_booking" && module.isEnabled');
    expect(code).toContain("activeServices > 0");
    expect(code).toContain("input.bookingHoursConfigured");
    expect(code).toContain("Boolean(input.publicBookingSlug)");
  });

  it("reuses industry seeding and marks onboarding complete only when the booking page is ready", () => {
    const code = source("src/app/dashboard/onboarding/page.tsx");

    expect(code).toContain("seedWorkspaceServicesForIndustry(industryKey)");
    expect(code).toContain("isComplete: launch.isReady");
    expect(code).toContain('completedSteps.push("services")');
    expect(code).toContain('completedSteps.push("hours")');
    expect(code).toContain('completedSteps.push("booking")');
    expect(code).toContain('completedSteps.push("publish")');
  });

  it("shows the real booking link and QR flow as soon as launch readiness is satisfied", () => {
    const code = source("src/app/dashboard/onboarding/page.tsx");

    expect(code).toContain("<BookingLinkCard url={launch.bookingUrl} />");
    expect(code).toContain("Din första bokningssida är klar ✅");
    expect(code).toContain("Finputs efter lansering");
  });
});
