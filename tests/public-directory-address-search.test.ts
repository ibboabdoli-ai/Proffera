import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  cookies: vi.fn(),
  cookieSet: vi.fn(),
  redirect: vi.fn(),
  verify: vi.fn(),
  allowed: vi.fn(),
  sql: vi.fn(),
  getSql: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies, headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/lantmateriet-address-verification", () => ({ verifyCustomerAddress: mocks.verify }));
vi.mock("@/lib/public-form-protection", () => ({ allowPublicSubmission: mocks.allowed }));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));

import { refinePublicDirectoryNearbyAction, searchPublicDirectoryAddressAction } from "@/components/company-directory/public-directory-nearby-action";

function request(address: string, radius = "10") {
  const form = new FormData();
  form.set("locale", "sv");
  form.set("service", "vvs");
  form.set("address", address);
  form.set("radius", radius);
  return form;
}

describe("verified private-address search", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetAllMocks();
    mocks.headers.mockResolvedValue(new Headers());
    mocks.cookies.mockResolvedValue({ set: mocks.cookieSet });
    mocks.allowed.mockResolvedValue(true);
    mocks.getSql.mockReturnValue(mocks.sql);
    mocks.verify.mockResolvedValue({
      status: "matched",
      easting: 674000,
      northing: 6580000,
      referenceId: "439b33bf-6279-4b65-b32c-9741646d8d3e",
    });
    mocks.sql.mockResolvedValue([{ latitude: 59.3293, longitude: 18.0686 }]);
    mocks.redirect.mockImplementation(() => { throw new Error("NEXT_REDIRECT"); });
  });

  afterEach(() => vi.unstubAllEnvs());


  it("refines a nearby search with the existing private cookie without another DB or address lookup", async () => {
    mocks.cookies.mockResolvedValue({
      set: mocks.cookieSet,
      get: vi.fn().mockReturnValue({ value: "59.329300,18.068600" }),
    });
    const form = request("", "35");
    form.set("service", "vvs");
    await expect(refinePublicDirectoryNearbyAction(form)).rejects.toThrow("NEXT_REDIRECT");
    const destination = String(mocks.redirect.mock.calls[0]?.[0]);
    expect(destination).toBe("/foretag/listad?nearby=1&radius=35&service=vvs");
    expect(destination).not.toContain("address=");
    expect(destination).not.toContain("latitude=");
    expect(destination).not.toContain("59.3293");
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.getSql).not.toHaveBeenCalled();
  });

  it("fails closed when refining after the private location cookie expires or is malformed", async () => {
    for (const value of [undefined, "91,18"]) {
      mocks.cookies.mockResolvedValue({
        set: mocks.cookieSet,
        get: vi.fn().mockReturnValue(value ? { value } : undefined),
      });
      await expect(refinePublicDirectoryNearbyAction(request("", "10"))).resolves.toEqual({
        error: "location_expired",
      });
    }
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.getSql).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("requires a service and clamps refinement radius without leaking origin details", async () => {
    mocks.cookies.mockResolvedValue({
      set: mocks.cookieSet,
      get: vi.fn().mockReturnValue({ value: "59.329300,18.068600" }),
    });
    const invalid = request("", "10");
    invalid.set("service", "");
    await expect(refinePublicDirectoryNearbyAction(invalid)).resolves.toEqual({ error: "invalid_service" });
    expect(mocks.redirect).not.toHaveBeenCalled();

    await expect(refinePublicDirectoryNearbyAction(request("", "200"))).rejects.toThrow("NEXT_REDIRECT");
    expect(String(mocks.redirect.mock.calls[0]?.[0])).toBe(
      "/foretag/listad?nearby=1&radius=50&service=vvs",
    );
  });

  it("rejects ambiguous and incomplete addresses before making external or DB requests", async () => {
    await expect(searchPublicDirectoryAddressAction(request("Stockholm"))).resolves.toEqual({ error: "invalid_address" });
    await expect(searchPublicDirectoryAddressAction(request("Storgatan 5, 151 72 Södertälje, extra"))).resolves.toEqual({ error: "invalid_address" });
    expect(mocks.verify).not.toHaveBeenCalled();
    expect(mocks.allowed).not.toHaveBeenCalled();
    expect(mocks.getSql).not.toHaveBeenCalled();
  });

  it("does not return nearby businesses when provider verification fails", async () => {
    mocks.verify.mockResolvedValue({ status: "no_match", reason: "no_reference" });
    await expect(searchPublicDirectoryAddressAction(request("Storgatan 5, 151 72 Södertälje"))).resolves.toEqual({ error: "not_found" });
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("rate limits official address lookups and refuses unsafe fallbacks", async () => {
    mocks.allowed.mockResolvedValue(false);
    await expect(searchPublicDirectoryAddressAction(request("Storgatan 5, 151 72 Södertälje"))).resolves.toEqual({ error: "rate_limited" });
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("keeps verified location in short-lived HttpOnly cookies and clamps 50 km", async () => {
    await expect(searchPublicDirectoryAddressAction(request("Storgatan 5, 151 72 Södertälje", "100"))).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.verify).toHaveBeenCalledWith({
      addressLine1: "Storgatan 5",
      postalCode: "151 72",
      city: "Södertälje",
    });
    expect(mocks.cookieSet).toHaveBeenCalledTimes(2);
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      "proffera_public_directory_nearby_sv",
      "59.329300,18.068600",
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax", maxAge: 300, path: "/foretag/listad" }),
    );
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      "proffera_public_directory_nearby_en",
      "59.329300,18.068600",
      expect.objectContaining({ httpOnly: true, secure: true, sameSite: "lax", maxAge: 300, path: "/en/companies" }),
    );
    const destination = String(mocks.redirect.mock.calls[0]?.[0]);
    expect(destination).toContain("service=vvs");
    expect(destination).toContain("radius=50");
    expect(destination).toContain("nearby=1");
    expect(destination).not.toContain("Storgatan");
    expect(destination).not.toContain("latitude");
    expect(destination).not.toContain("59.3293");
  });

  it("fails closed when Lantmäteriet or coordinate conversion is unavailable", async () => {
    mocks.verify.mockResolvedValue({ status: "unavailable", reason: "not_configured" });
    await expect(searchPublicDirectoryAddressAction(request("Storgatan 5, 151 72 Södertälje"))).resolves.toEqual({ error: "unavailable" });
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    mocks.verify.mockResolvedValue({ status: "matched", easting: 674000, northing: 6580000 });
    mocks.sql.mockResolvedValue([{ latitude: null, longitude: null }]);
    await expect(searchPublicDirectoryAddressAction(request("Storgatan 5, 151 72 Södertälje"))).resolves.toEqual({ error: "unavailable" });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
