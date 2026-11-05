import { afterEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  slug: "makeup-by-maria",
  sqlOpened: 0,
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error("Redirect: " + path);
  },
}));
vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: async () => ({
    ok: true, workspaceId: "00000000-0000-4000-8000-000000000001",
    workspaceSlug: fixture.slug,
  }),
  canManageWorkspaceSettings: () => true,
}));
vi.mock("@/lib/workspace-booking-hours-db", () => ({
  bookingWeekdays: [{ value: 5 }, { value: 6 }, { value: 0 }],
}));
vi.mock("@/lib/db/server", () => ({
  getSql: () => {
    fixture.sqlOpened += 1;
    throw new Error("Synthetic database must not be opened for Maria Preview");
  },
}));

import { updateWorkspaceBookingHoursAction } from "./booking-hours-actions";

describe("Maria Preview booking-hours ownership", () => {
  afterEach(() => {
    fixture.slug = "makeup-by-maria";
    fixture.sqlOpened = 0;
    vi.unstubAllEnvs();
  });

  it("rejects the generic settings writer before any database call", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    await expect(updateWorkspaceBookingHoursAction(new FormData()))
      .rejects.toThrow("Redirect: /dashboard/installningar?hours_error=access");
    expect(fixture.sqlOpened).toBe(0);
  });

  it("leaves unrelated workspaces on their existing generic writer", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    fixture.slug = "unrelated-workspace";
    const form = new FormData();
    for (const day of [5, 6, 0]) form.set("closed_" + day, "on");
    await expect(updateWorkspaceBookingHoursAction(form))
      .rejects.toThrow("Synthetic database must not be opened for Maria Preview");
    expect(fixture.sqlOpened).toBe(1);
  });
});
