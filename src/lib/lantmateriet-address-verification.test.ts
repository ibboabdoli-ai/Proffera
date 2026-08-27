import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { verifyCustomerAddress } from "./lantmateriet-address-verification";

const registerUnitId = "439b33bf-6279-4b65-b32c-9741646d8d3e";
const secondRegisterUnitId = "439b33bf-6279-4b65-b32c-9741646d8d3f";
const addressId = "539b33bf-6279-4b65-b32c-9741646d8d3e";
const secondAddressId = "539b33bf-6279-4b65-b32c-9741646d8d3f";

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function addressFeature(input: {
  registerId?: string;
  id?: string;
  street?: string;
  number?: string;
  postnummer?: number;
  postort?: string;
} = {}) {
  const id = input.id ?? addressId;
  return {
    type: "Feature",
    id,
    geometry: { type: "Point", coordinates: [674000, 6580000] },
    properties: {
      objektidentitet: id,
      registerenhetsreferens: {
        objektidentitet: input.registerId ?? registerUnitId,
      },
      adressplatsattribut: {
        postnummer: input.postnummer ?? 11264,
        postort: input.postort ?? "Stockholm",
        adressplatsbeteckning: { adressplatsnummer: input.number ?? "7", bokstavstillagg: "A" },
      },
      adressomrade: { faststalltNamn: input.street ?? "Segelbåtsvägen" },
    },
  };
}

function registerUnitDetail(...features: unknown[]) {
  return { type: "FeatureCollection", features };
}

describe("customer Lantmäteriet address verification", () => {
  beforeEach(() => {
    vi.stubEnv("LANTMATERIET_ADDRESS_API_USERNAME", "preview-user");
    vi.stubEnv("LANTMATERIET_ADDRESS_API_PASSWORD", "preview-password");
    vi.stubEnv(
      "LANTMATERIET_ADDRESS_API_BASE_URL",
      "https://api-ver.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2",
    );
    vi.stubEnv(
      "LANTMATERIET_ADDRESS_LOOKUP_API_BASE_URL",
      "https://api-ver.lantmateriet.se/distribution/produkter/uppslag/adress/v3",
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses the lookup UUID as a register unit and returns the matched address UUID", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{
        objektidentitet: registerUnitId,
        adress: "Segelbåtsvägen 7A, 112 64 Stockholm",
        adressComponents: { postnummer: 11264, postort: "Stockholm" },
      }]))
      .mockResolvedValueOnce(jsonResponse(registerUnitDetail(addressFeature())));
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyCustomerAddress({
      addressLine1: "Segelbåtsvägen 7 A",
      postalCode: "112 64",
      city: "Stockholm",
    });

    expect(result).toEqual({
      status: "matched",
      source: "lantmateriet_belagenhetsadress_v4_2",
      referenceId: addressId,
      easting: 674000,
      northing: 6580000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const searchUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(searchUrl.pathname).toBe("/distribution/produkter/uppslag/adress/v3/fritext");
    expect(searchUrl.searchParams.get("adress")).toBe("Segelbåtsvägen 7 A, Stockholm");
    const detailUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(detailUrl.pathname).toBe(
      `/distribution/produkter/belagenhetsadress/v4.2/registerenhet/${registerUnitId}`,
    );
    expect(detailUrl.searchParams.get("includeData")).toBe("basinformation");
    expect(detailUrl.searchParams.get("srid")).toBe("3006");
  });

  it("selects exactly one matching address from a multi-address register unit", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{
        objektidentitet: registerUnitId,
        adressComponents: { postnummer: 11264, postort: "Stockholm" },
      }]))
      .mockResolvedValueOnce(jsonResponse(registerUnitDetail(
        addressFeature({ id: secondAddressId, street: "Annan gata", number: "9" }),
        addressFeature(),
      )));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyCustomerAddress({
      addressLine1: "Segelbåtsvägen 7 A",
      postalCode: "112 64",
      city: "Stockholm",
    })).resolves.toMatchObject({ status: "matched", referenceId: addressId });
  });

  it("retries an empty city-qualified lookup once with cleaned street-only text", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyCustomerAddress({
      addressLine1: "Okändgatan 99, 3tr",
      postalCode: "151 46",
      city: "Södertälje",
    })).resolves.toEqual({ status: "no_match", reason: "no_reference" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetchMock.mock.calls[0]?.[0])).searchParams.get("adress"))
      .toBe("Okändgatan 99, Södertälje");
    expect(new URL(String(fetchMock.mock.calls[1]?.[0])).searchParams.get("adress"))
      .toBe("Okändgatan 99");
  });

  it("rejects an invalid official register unit reference before any detail request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([{
      objektidentitet: "not-a-uuid",
      adressComponents: { postnummer: 11264, postort: "Stockholm" },
    }]));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyCustomerAddress({
      addressLine1: "Segelbåtsvägen 7 A",
      postalCode: "112 64",
      city: "Stockholm",
    })).resolves.toEqual({ status: "no_match", reason: "invalid_reference" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects an exact address whose register unit reference points elsewhere", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{
        objektidentitet: registerUnitId,
        adressComponents: { postnummer: 11264, postort: "Stockholm" },
      }]))
      .mockResolvedValueOnce(jsonResponse(registerUnitDetail(addressFeature({
        registerId: secondRegisterUnitId,
      }))));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyCustomerAddress({
      addressLine1: "Segelbåtsvägen 7 A",
      postalCode: "112 64",
      city: "Stockholm",
    })).resolves.toEqual({ status: "no_match", reason: "invalid_reference" });
  });

  it("rejects two different exact register-unit candidates as ambiguous", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([
        {
          objektidentitet: registerUnitId,
          adressComponents: { postnummer: 11264, postort: "Stockholm" },
        },
        {
          objektidentitet: secondRegisterUnitId,
          adressComponents: { postnummer: 11264, postort: "Stockholm" },
        },
      ]))
      .mockResolvedValueOnce(jsonResponse(registerUnitDetail(addressFeature())))
      .mockResolvedValueOnce(jsonResponse(registerUnitDetail(addressFeature({
        registerId: secondRegisterUnitId,
        id: secondAddressId,
      }))));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyCustomerAddress({
      addressLine1: "Segelbåtsvägen 7 A",
      postalCode: "112 64",
      city: "Stockholm",
    })).resolves.toEqual({ status: "no_match", reason: "ambiguous_exact_match" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("deduplicates the same exact address returned through multiple register units", async () => {
    const baseFeature = addressFeature();
    const sharedFeature = {
      ...baseFeature,
      properties: {
        ...baseFeature.properties,
        registerenhetsreferens: [
          { objektidentitet: registerUnitId },
          { objektidentitet: secondRegisterUnitId },
        ],
      },
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([
        {
          objektidentitet: registerUnitId,
          adressComponents: { postnummer: 11264, postort: "Stockholm" },
        },
        {
          objektidentitet: secondRegisterUnitId,
          adressComponents: { postnummer: 11264, postort: "Stockholm" },
        },
      ]))
      .mockResolvedValueOnce(jsonResponse(registerUnitDetail(sharedFeature)))
      .mockResolvedValueOnce(jsonResponse(registerUnitDetail(sharedFeature)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyCustomerAddress({
      addressLine1: "Segelbåtsvägen 7 A",
      postalCode: "112 64",
      city: "Stockholm",
    })).resolves.toEqual({
      status: "matched",
      source: "lantmateriet_belagenhetsadress_v4_2",
      referenceId: addressId,
      easting: 674000,
      northing: 6580000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reports missing credentials without making an upstream request", async () => {
    vi.stubEnv("LANTMATERIET_ADDRESS_API_USERNAME", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyCustomerAddress({
      addressLine1: "Storgatan 12",
      postalCode: "151 46",
      city: "Södertälje",
    })).resolves.toEqual({ status: "unavailable", reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-HTTPS detail base URL without making an upstream request", async () => {
    vi.stubEnv(
      "LANTMATERIET_ADDRESS_API_BASE_URL",
      "http://api-ver.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2",
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyCustomerAddress({
      addressLine1: "Storgatan 12",
      postalCode: "151 46",
      city: "Södertälje",
    })).resolves.toEqual({ status: "unavailable", reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a non-HTTPS lookup base URL without making an upstream request", async () => {
    vi.stubEnv(
      "LANTMATERIET_ADDRESS_LOOKUP_API_BASE_URL",
      "http://api-ver.lantmateriet.se/distribution/produkter/uppslag/adress/v3",
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyCustomerAddress({
      addressLine1: "Storgatan 12",
      postalCode: "151 46",
      city: "Södertälje",
    })).resolves.toEqual({ status: "unavailable", reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("strips configured query and fragment components from approved base URLs", async () => {
    vi.stubEnv(
      "LANTMATERIET_ADDRESS_API_BASE_URL",
      "https://api-ver.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2?unexpected=1#fragment",
    );
    vi.stubEnv(
      "LANTMATERIET_ADDRESS_LOOKUP_API_BASE_URL",
      "https://api-ver.lantmateriet.se/distribution/produkter/uppslag/adress/v3?unexpected=1#fragment",
    );
    const fetchMock = vi.fn().mockImplementation(async () => jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await verifyCustomerAddress({
      addressLine1: "Storgatan 12",
      postalCode: "151 46",
      city: "Södertälje",
    });

    const calledUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(calledUrl.searchParams.get("unexpected")).toBeNull();
    expect(calledUrl.hash).toBe("");
  });

  it("contains an upstream timeout as a retryable unavailable result", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")));

    await expect(verifyCustomerAddress({
      addressLine1: "Storgatan 12",
      postalCode: "151 46",
      city: "Södertälje",
    })).resolves.toEqual({ status: "unavailable", reason: "timeout" });
  });
});
