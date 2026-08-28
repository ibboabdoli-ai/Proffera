import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  redirect: vi.fn(),
  cookieSet: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));
vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

import { searchPublicDirectoryNearbyAction } from "@/components/company-directory/public-directory-nearby-action";
import {
  parsePublicDirectoryNearbyValue,
  publicDirectoryNearbyCookieName,
  publicDirectoryNearbyCookiePath,
  serializePublicDirectoryNearbyValue,
} from "@/lib/public-directory-nearby";

describe("public Directory Nearby privacy", () => {
  beforeEach(() => {
    mocks.cookies.mockReset();
    mocks.redirect.mockReset();
    mocks.cookieSet.mockReset();
    mocks.cookies.mockResolvedValue({ set: mocks.cookieSet });
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("validates and normalizes private Nearby coordinates", () => {
    expect(parsePublicDirectoryNearbyValue("59.329323,18.068581")).toEqual({
      latitude: 59.329323,
      longitude: 18.068581,
    });
    expect(serializePublicDirectoryNearbyValue("59.3293234,18.0685806")).toBe("59.329323,18.068581");
    expect(parsePublicDirectoryNearbyValue("91,18")).toBeNull();
    expect(parsePublicDirectoryNearbyValue("59,181")).toBeNull();
    expect(parsePublicDirectoryNearbyValue("59")).toBeNull();
  });

  it("stores a valid position in short-lived HttpOnly locale cookies and redirects without coordinates", async () => {
    const formData = new FormData();
    formData.set("locale", "sv");
    formData.set("radius", "50");
    formData.set("nearbyCoordinates", "59.3293234,18.0685806");

    await expect(searchPublicDirectoryNearbyAction(formData)).rejects.toThrow("NEXT_REDIRECT");

    expect(publicDirectoryNearbyCookieName("sv")).toBe("proffera_public_directory_nearby_sv");
    expect(publicDirectoryNearbyCookieName("en")).toBe("proffera_public_directory_nearby_en");
    expect(publicDirectoryNearbyCookiePath("sv")).toBe("/foretag/listad");
    expect(publicDirectoryNearbyCookiePath("en")).toBe("/en/companies");
    expect(mocks.cookieSet).toHaveBeenCalledTimes(2);
    expect(mocks.cookieSet).toHaveBeenNthCalledWith(
      1,
      "proffera_public_directory_nearby_sv",
      "59.329323,18.068581",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        maxAge: 300,
        path: "/foretag/listad",
      }),
    );
    expect(mocks.cookieSet).toHaveBeenNthCalledWith(
      2,
      "proffera_public_directory_nearby_en",
      "59.329323,18.068581",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        maxAge: 300,
        path: "/en/companies",
      }),
    );

    const destination = String(mocks.redirect.mock.calls[0]?.[0] ?? "");
    expect(destination).toBe("/foretag/listad?nearby=1&radius=50");
    expect(destination).not.toContain("latitude");
    expect(destination).not.toContain("longitude");
    expect(destination).not.toContain("59.329323");
    expect(destination).not.toContain("18.068581");
  });

  it("expires both locale cookies when submitted coordinates are invalid", async () => {
    const formData = new FormData();
    formData.set("locale", "en");
    formData.set("radius", "25");
    formData.set("nearbyCoordinates", "91,18.068581");

    await expect(searchPublicDirectoryNearbyAction(formData)).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.cookieSet).toHaveBeenCalledTimes(2);
    expect(mocks.cookieSet).toHaveBeenNthCalledWith(
      1,
      "proffera_public_directory_nearby_sv",
      "",
      expect.objectContaining({ maxAge: 0, path: "/foretag/listad" }),
    );
    expect(mocks.cookieSet).toHaveBeenNthCalledWith(
      2,
      "proffera_public_directory_nearby_en",
      "",
      expect.objectContaining({ maxAge: 0, path: "/en/companies" }),
    );

    const destination = String(mocks.redirect.mock.calls[0]?.[0] ?? "");
    expect(destination).toBe("/en/companies?nearby=1&radius=25");
    expect(destination).not.toContain("latitude");
    expect(destination).not.toContain("longitude");
  });
});
