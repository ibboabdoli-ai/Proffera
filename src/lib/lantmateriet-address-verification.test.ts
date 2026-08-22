import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { verifyCustomerAddress } from "./lantmateriet-address-verification";

const referenceId = "439b33bf-6279-4b65-b32c-9741646d8d3e";
const secondReferenceId = "439b33bf-6279-4b65-b32c-9741646d8d3f";

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function exactDetail() {
  return {
    type: "FeatureCollection",
    features: [{
      geometry: { type: "Point", coordinates: [674000, 6580000] },
      properties: {
        adressplatsattribut: {
          postnummer: 11264,
          postort: "Stockholm",
          adressplatsbeteckning: { adressplatsnummer: "7", bokstavstillagg: "A" },
        },
        adressomrade: { faststalltNamn: "Segelbåtsvägen" },
      },
    }],
  };
}

describe("customer Lantmäteriet address verification", () => {
  beforeEach(() => {
    vi.stubEnv("LANTMATERIET_ADDRESS_API_USERNAME", "preview-user");
    vi.stubEnv("LANTMATERIET_ADDRESS_API_PASSWORD", "preview-password");
    vi.stubEnv(
      "LANTMATERIET_ADDRESS_API_BASE_URL",
      "https://api-ver.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2",
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns one exact official address with its SWEREF point and private reference", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{
        objektidentitet: referenceId,
        adress: "Segelbåtsvägen 7A, 112 64 Stockholm",
        adressComponents: { postnummer: 11264, postort: "Stockholm" },
      }]))
      .mockResolvedValueOnce(jsonResponse(exactDetail()));
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyCustomerAddress({
      addressLine1: "Segelbåtsvägen 7 A",
      postalCode: "112 64",
      city: "Stockholm",
    });

    expect(result).toEqual({
      status: "matched",
      source: "lantmateriet_belagenhetsadress_v4_2",
      referenceId,
      easting: 674000,
      northing: 6580000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const searchUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(searchUrl.pathname).toBe("/distribution/produkter/belagenhetsadress/v4.2/referens/fritext");
    expect(searchUrl.searchParams.get("adress")).toBe("Segelbåtsvägen 7 A, Stockholm");
    expect(searchUrl.searchParams.get("status")).toBe("Gällande");
    const detailUrl = new URL(String(fetchMock.mock.calls[1]?.[0]));
    expect(detailUrl.pathname).toContain(referenceId);
    expect(detailUrl.searchParams.get("srid")).toBe("3006");
  });

  it("rejects an address when the official search has no reference", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    await expect(verifyCustomerAddress({
      addressLine1: "Okändgatan 99",
      postalCode: "151 46",
      city: "Södertälje",
    })).resolves.toEqual({ status: "no_match", reason: "no_reference" });
  });

  it("rejects an invalid official object reference before any detail request", async () => {
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

  it("rejects two exact official candidates as ambiguous", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([
        {
          objektidentitet: referenceId,
          adress: "Segelbåtsvägen 7A, 112 64 Stockholm",
          adressComponents: { postnummer: 11264, postort: "Stockholm" },
        },
        {
          objektidentitet: secondReferenceId,
          adress: "Segelbåtsvägen 7A, 112 64 Stockholm",
          adressComponents: { postnummer: 11264, postort: "Stockholm" },
        },
      ]))
      .mockResolvedValueOnce(jsonResponse(exactDetail()))
      .mockResolvedValueOnce(jsonResponse(exactDetail()));
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyCustomerAddress({
      addressLine1: "Segelbåtsvägen 7 A",
      postalCode: "112 64",
      city: "Stockholm",
    })).resolves.toEqual({ status: "no_match", reason: "ambiguous_exact_match" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reports missing configuration without making an upstream request", async () => {
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

  it("rejects a non-HTTPS configured base URL without making an upstream request", async () => {
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

  it("strips configured query and fragment components from the base URL", async () => {
    vi.stubEnv(
      "LANTMATERIET_ADDRESS_API_BASE_URL",
      "https://api-ver.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2?unexpected=1#fragment",
    );
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
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
