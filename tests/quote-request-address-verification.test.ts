import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  allowPublicSubmission: vi.fn(),
  verifyCustomerAddress: vi.fn(),
  storeQuoteRequest: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/lib/public-form-protection", () => ({ allowPublicSubmission: mocks.allowPublicSubmission }));
vi.mock("@/lib/lantmateriet-address-verification", () => ({
  verifyCustomerAddress: mocks.verifyCustomerAddress,
}));
vi.mock("@/features/quote-request/persistence", () => ({ storeQuoteRequest: mocks.storeQuoteRequest }));

import { submitQuoteRequest } from "@/features/quote-request/actions";
import { initialQuoteRequest } from "@/features/quote-request/schema";

const baseRequest = {
  ...initialQuoteRequest,
  category: "Elektriker",
  serviceType: "Felsökning el",
  city: "Södertälje",
  postalCode: "151 46",
  description: "Jag behöver hjälp med felsökning av el i bostaden.",
  preferredDate: "Inom en vecka",
  contactName: "Test Customer",
  contactEmail: "customer@example.com",
  contactPhone: "0700000000",
  consentAccepted: true,
  website: "",
};

function request(overrides: Record<string, unknown> = {}) {
  return {
    ...baseRequest,
    addressLine1: "Storgatan 12",
    locationSource: "address" as const,
    latitude: null,
    longitude: null,
    formStartedAt: Date.now() - 3_000,
    ...overrides,
  };
}

describe("quote request official address verification", () => {
  beforeEach(() => {
    mocks.headers.mockReset();
    mocks.allowPublicSubmission.mockReset();
    mocks.verifyCustomerAddress.mockReset();
    mocks.storeQuoteRequest.mockReset();

    mocks.headers.mockResolvedValue(new Headers());
    mocks.allowPublicSubmission.mockResolvedValue(true);
    mocks.verifyCustomerAddress.mockResolvedValue({
      status: "matched",
      source: "lantmateriet_belagenhetsadress_v4_2",
      referenceId: "439b33bf-6279-4b65-b32c-9741646d8d3e",
      easting: 674000,
      northing: 6580000,
    });
    mocks.storeQuoteRequest.mockResolvedValue({ ok: true, referenceId: "PRO-TEST" });
  });

  it("runs abuse protection before Lantmäteriet and persists only an exact matched result", async () => {
    const result = await submitQuoteRequest(request());

    expect(result).toEqual({ ok: true, referenceId: "PRO-TEST" });
    expect(mocks.allowPublicSubmission).toHaveBeenCalledTimes(1);
    expect(mocks.verifyCustomerAddress).toHaveBeenCalledWith({
      addressLine1: "Storgatan 12",
      postalCode: "151 46",
      city: "Södertälje",
    });
    expect(mocks.storeQuoteRequest).toHaveBeenCalledWith(
      expect.objectContaining({ locationSource: "address", addressLine1: "Storgatan 12" }),
      expect.objectContaining({
        status: "matched",
        referenceId: "439b33bf-6279-4b65-b32c-9741646d8d3e",
      }),
    );
    expect(mocks.allowPublicSubmission.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.verifyCustomerAddress.mock.invocationCallOrder[0]);
  });

  it("does not call Lantmäteriet when abuse protection denies the submission", async () => {
    mocks.allowPublicSubmission.mockResolvedValue(false);

    const result = await submitQuoteRequest(request());

    expect(result).toEqual({
      ok: false,
      errors: { form: "För många försök. Vänta en stund och försök igen." },
    });
    expect(mocks.verifyCustomerAddress).not.toHaveBeenCalled();
    expect(mocks.storeQuoteRequest).not.toHaveBeenCalled();
  });

  it("rejects a definitive official no-match before persistence", async () => {
    mocks.verifyCustomerAddress.mockResolvedValue({ status: "no_match", reason: "street_mismatch" });

    const result = await submitQuoteRequest(request());

    expect(result).toEqual({
      ok: false,
      errors: {
        addressLine1: "Adressen kunde inte verifieras mot Lantmäteriets adressregister. Kontrollera gata, postnummer och ort.",
      },
    });
    expect(mocks.storeQuoteRequest).not.toHaveBeenCalled();
  });

  it.each([
    "too_many_candidates",
    "ambiguous_exact_match",
    "unexpected_reference_response",
  ])("continues unverified for non-customer-correctable no-match reason %s", async (reason) => {
    mocks.verifyCustomerAddress.mockResolvedValue({ status: "no_match", reason });

    const result = await submitQuoteRequest(request());

    expect(result).toEqual({ ok: true, referenceId: "PRO-TEST" });
    expect(mocks.storeQuoteRequest).toHaveBeenCalledWith(
      expect.objectContaining({ locationSource: "address" }),
      undefined,
    );
  });

  it("fails closed for a configured upstream outage", async () => {
    mocks.verifyCustomerAddress.mockResolvedValue({ status: "unavailable", reason: "timeout" });

    const result = await submitQuoteRequest(request());

    expect(result).toEqual({
      ok: false,
      errors: {
        form: "Adressen kunde inte verifieras just nu. Försök igen om en stund eller använd Nära mig.",
      },
    });
    expect(mocks.storeQuoteRequest).not.toHaveBeenCalled();
  });

  it("preserves the existing address flow when Lantmäteriet is not configured", async () => {
    mocks.verifyCustomerAddress.mockResolvedValue({ status: "unavailable", reason: "not_configured" });

    const result = await submitQuoteRequest(request());

    expect(result).toEqual({ ok: true, referenceId: "PRO-TEST" });
    expect(mocks.storeQuoteRequest).toHaveBeenCalledWith(
      expect.objectContaining({ locationSource: "address" }),
      undefined,
    );
  });

  it("never calls Lantmäteriet for explicit browser geolocation", async () => {
    const result = await submitQuoteRequest(request({
      addressLine1: "",
      locationSource: "geolocation",
      latitude: 59.19554,
      longitude: 17.62525,
    }));

    expect(result).toEqual({ ok: true, referenceId: "PRO-TEST" });
    expect(mocks.verifyCustomerAddress).not.toHaveBeenCalled();
    expect(mocks.storeQuoteRequest).toHaveBeenCalledWith(
      expect.objectContaining({ locationSource: "geolocation" }),
      undefined,
    );
  });
});
