import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { verifyCustomerAddress } from "./lantmateriet-address-verification";

const referenceId = "439b33bf-6279-4b65-b32c-9741646d8d3e";

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
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
  });

  it("returns one exact official address with its SWEREF point and private reference", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([{
        objektidentitet: referenceId,
        adress: "Segelbåtsvägen 7A, 112 64 Stockholm",
        adressComponents: { postnummer: 11264, postort: "Stockholm" },
      }]))
      .mockResolvedValueOnce(jsonResponse({
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
      }));
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

  it("contains an upstream timeout as a retryable unavailable result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("Timed out", "TimeoutError")));

    await expect(verifyCustomerAddress({
      addressLine1: "Storgatan 12",
      postalCode: "151 46",
      city: "Södertälje",
    })).resolves.toEqual({ status: "unavailable", reason: "timeout" });
  });
});
