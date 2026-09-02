import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  afterTasks: [] as Array<() => Promise<void> | void>,
  allowPublicSubmission: vi.fn(),
  headers: vi.fn(),
  resolveMarketplacePublicBaseUrl: vi.fn(),
  runMarketplaceAutoWorkerTrigger: vi.fn(),
  storeQuoteRequest: vi.fn(),
  verifyCustomerAddress: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/lantmateriet-address-verification", () => ({
  verifyCustomerAddress: mocks.verifyCustomerAddress,
}));
vi.mock("@/lib/marketplace-auto-worker-trigger", () => ({
  runMarketplaceAutoWorkerTrigger: mocks.runMarketplaceAutoWorkerTrigger,
}));
vi.mock("@/lib/marketplace-public-base-url", () => ({
  resolveMarketplacePublicBaseUrl: mocks.resolveMarketplacePublicBaseUrl,
}));
vi.mock("@/lib/public-form-protection", () => ({
  allowPublicSubmission: mocks.allowPublicSubmission,
}));
vi.mock("@/features/quote-request/persistence", () => ({
  storeQuoteRequest: mocks.storeQuoteRequest,
}));

import { submitQuoteRequest } from "@/features/quote-request/actions";

function validSubmission() {
  return {
    category: "Städning",
    serviceType: "Hemstädning",
    addressLine1: "",
    locationSource: "geolocation" as const,
    latitude: 59.1955,
    longitude: 17.6253,
    city: "Södertälje",
    postalCode: "151 72",
    description: "Jag behöver hjälp med regelbunden hemstädning i bostaden.",
    preferredDate: "Så snart som möjligt",
    contactName: "Test Kund",
    contactEmail: "customer@example.com",
    contactPhone: "+46701234567",
    consentAccepted: true,
    formStartedAt: Date.now() - 3_000,
  };
}

describe("Quote Request Marketplace event trigger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.afterTasks.length = 0;
    mocks.headers.mockResolvedValue(new Headers());
    mocks.allowPublicSubmission.mockResolvedValue(true);
    mocks.storeQuoteRequest.mockResolvedValue({
      ok: true,
      referenceId: "PRO-TEST-12345",
      created: true,
    });
    mocks.resolveMarketplacePublicBaseUrl.mockReturnValue("https://www.proffera.se");
    mocks.runMarketplaceAutoWorkerTrigger.mockResolvedValue({ ok: true, scanned: 0, attempted: 0, sent: 0 });
    mocks.after.mockImplementation((task: () => Promise<void> | void) => {
      mocks.afterTasks.push(task);
    });
  });

  it("kicks only the newly persisted Quote Request without delaying the response", async () => {
    const result = await submitQuoteRequest(validSubmission());

    expect(result).toEqual({ ok: true, referenceId: "PRO-TEST-12345" });
    expect(mocks.after).toHaveBeenCalledTimes(1);
    expect(mocks.runMarketplaceAutoWorkerTrigger).not.toHaveBeenCalled();

    await mocks.afterTasks[0]?.();

    expect(mocks.runMarketplaceAutoWorkerTrigger).toHaveBeenCalledTimes(1);
    expect(mocks.runMarketplaceAutoWorkerTrigger).toHaveBeenCalledWith({
      baseUrl: "https://www.proffera.se",
      targetReferenceIds: ["PRO-TEST-12345"],
    });
  });

  it("keeps a successful submission successful when the deferred worker rejects", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.runMarketplaceAutoWorkerTrigger.mockRejectedValue(new Error("worker failed"));

    try {
      const result = await submitQuoteRequest(validSubmission());

      expect(result).toEqual({ ok: true, referenceId: "PRO-TEST-12345" });
      expect(mocks.after).toHaveBeenCalledTimes(1);
      await expect(Promise.resolve(mocks.afterTasks[0]?.())).resolves.toBeUndefined();
      expect(result).toEqual({ ok: true, referenceId: "PRO-TEST-12345" });
      expect(consoleError).toHaveBeenCalledTimes(1);
    } finally {
      consoleError.mockRestore();
    }
  });

  it("keeps a successful submission successful when the deferred worker returns not ok", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.runMarketplaceAutoWorkerTrigger.mockResolvedValue({ ok: false, error: "matching_failed" });

    try {
      const result = await submitQuoteRequest(validSubmission());

      expect(result).toEqual({ ok: true, referenceId: "PRO-TEST-12345" });
      expect(mocks.after).toHaveBeenCalledTimes(1);
      await expect(Promise.resolve(mocks.afterTasks[0]?.())).resolves.toBeUndefined();
      expect(result).toEqual({ ok: true, referenceId: "PRO-TEST-12345" });
      expect(consoleError).toHaveBeenCalledWith(
        "Marketplace Auto Worker event trigger failed after Quote Request submission",
        { error: "matching_failed" },
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("does not schedule the worker for a recent duplicate Quote Request", async () => {
    mocks.storeQuoteRequest.mockResolvedValue({
      ok: true,
      referenceId: "PRO-EXISTING-12345",
      created: false,
    });

    const result = await submitQuoteRequest(validSubmission());

    expect(result).toEqual({ ok: true, referenceId: "PRO-EXISTING-12345" });
    expect(mocks.after).not.toHaveBeenCalled();
    expect(mocks.runMarketplaceAutoWorkerTrigger).not.toHaveBeenCalled();
  });

  it("does not schedule the worker when persistence fails", async () => {
    mocks.storeQuoteRequest.mockResolvedValue({ ok: false, message: "Kunde inte spara" });

    const result = await submitQuoteRequest(validSubmission());

    expect(result.ok).toBe(false);
    expect(mocks.after).not.toHaveBeenCalled();
    expect(mocks.runMarketplaceAutoWorkerTrigger).not.toHaveBeenCalled();
  });

  it("does not schedule the worker for an invalid public submission", async () => {
    const result = await submitQuoteRequest({
      ...validSubmission(),
      serviceType: "Fel tjänst",
    });

    expect(result.ok).toBe(false);
    expect(mocks.storeQuoteRequest).not.toHaveBeenCalled();
    expect(mocks.after).not.toHaveBeenCalled();
  });
});
