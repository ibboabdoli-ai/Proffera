import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSuperAdmin: vi.fn(),
  geocodeDirectoryPilotFromAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  cookies: vi.fn(),
  redirect: vi.fn(),
  cookieSet: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));
vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));
vi.mock("@/lib/admin-authorization", () => ({
  requireSuperAdmin: mocks.requireSuperAdmin,
}));
vi.mock("@/lib/company-directory-geocoding", () => ({
  geocodeDirectoryPilotFromAdmin: mocks.geocodeDirectoryPilotFromAdmin,
}));

import {
  geocodeDirectoryPilotAction,
  searchDirectoryNearbyAction,
} from "@/app/admin/foretag/directory/search-preview/actions";
import { ADMIN_DIRECTORY_NEARBY_COOKIE } from "@/app/admin/foretag/directory/search-preview/search-behavior";

describe("admin directory Nearby server action", () => {
  beforeEach(() => {
    mocks.requireSuperAdmin.mockReset();
    mocks.geocodeDirectoryPilotFromAdmin.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.cookies.mockReset();
    mocks.redirect.mockReset();
    mocks.cookieSet.mockReset();

    mocks.requireSuperAdmin.mockResolvedValue(undefined);
    mocks.cookies.mockResolvedValue({ set: mocks.cookieSet });
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("limits the production geocoding pilot action to three companies per run", async () => {
    mocks.geocodeDirectoryPilotFromAdmin.mockResolvedValue({
      attempted: 3,
      geocoded: 1,
      noMatch: 2,
      errors: 0,
      remaining: 16,
      needsReview: 2,
    });

    await expect(geocodeDirectoryPilotAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.geocodeDirectoryPilotFromAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.geocodeDirectoryPilotFromAdmin).toHaveBeenCalledWith(3);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      "/admin/foretag/directory/search-preview",
    );
    expect(mocks.redirect).toHaveBeenCalledWith(expect.stringContaining("attempted=3"));
  });

  it("expires the previously scoped Nearby cookie when submitted coordinates are invalid", async () => {
    const formData = new FormData();
    formData.set("service", "Elektriker");
    formData.set("radius", "25");
    formData.set("nearbyCoordinates", "91,17.6253");

    await expect(searchDirectoryNearbyAction(formData)).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.requireSuperAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.cookieSet).toHaveBeenCalledTimes(1);
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      ADMIN_DIRECTORY_NEARBY_COOKIE,
      "",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        maxAge: 0,
        path: "/admin/foretag/directory/search-preview",
      }),
    );
  });

  it("stores a valid Nearby position briefly and redirects without exposing coordinates", async () => {
    const formData = new FormData();
    formData.set("service", "Elektriker");
    formData.set("radius", "50");
    formData.set("nearbyCoordinates", "59.1955,17.6253");

    await expect(searchDirectoryNearbyAction(formData)).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.requireSuperAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      ADMIN_DIRECTORY_NEARBY_COOKIE,
      "59.195500,17.625300",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        maxAge: 300,
        path: "/admin/foretag/directory/search-preview",
      }),
    );

    const destination = String(mocks.redirect.mock.calls[0]?.[0] ?? "");
    expect(destination).toContain("nearby=1");
    expect(destination).toContain("service=Elektriker");
    expect(destination).toContain("radius=50");
    expect(destination).not.toContain("latitude");
    expect(destination).not.toContain("longitude");
    expect(destination).not.toContain("59.195500");
    expect(destination).not.toContain("17.625300");
  });
});
