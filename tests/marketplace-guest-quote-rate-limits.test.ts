import { beforeEach, describe, expect, it, vi } from "vitest";

const TOKEN_A = "A".repeat(43);
const TOKEN_B = "B".repeat(43);
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

const mocks = vi.hoisted(() => ({
  allowPublicSubmission: vi.fn(),
  hashToken: vi.fn((token: string) => token.startsWith("B") ? "b".repeat(64) : "a".repeat(64)),
  submitQuote: vi.fn(),
  suppressRecipient: vi.fn(),
  notifyCustomer: vi.fn(),
}));

vi.mock("@/lib/public-form-protection", () => ({
  allowPublicSubmission: mocks.allowPublicSubmission,
}));
vi.mock("@/lib/marketplace-guest-quote", () => ({
  hashMarketplaceGuestToken: mocks.hashToken,
  submitMarketplaceGuestQuote: mocks.submitQuote,
  suppressMarketplaceGuestRecipient: mocks.suppressRecipient,
}));
vi.mock("@/lib/marketplace-customer-comparison", () => ({
  notifyMarketplaceCustomerOfferAvailableFromGuestToken: mocks.notifyCustomer,
}));

import { POST as postGuestQuote } from "@/app/api/marketplace/guest-quote/[token]/route";
import { POST as postGuestOptOut } from "@/app/api/marketplace/guest-quote/[token]/opt-out/route";

function context(token: string) {
  return { params: Promise.resolve({ token }) };
}

function quoteRequest(token = TOKEN_A, availableDate?: string) {
  const form = new FormData();
  form.set("priceKind", "fixed");
  form.set("amountSek", "1800");
  form.set("confirmAuthority", "yes");
  form.set("lang", "sv");
  if (availableDate !== undefined) form.set("availableDate", availableDate);
  return new Request(`https://www.proffera.se/api/marketplace/guest-quote/${token}`, {
    method: "POST",
    headers: { origin: "https://www.proffera.se" },
    body: form,
  });
}

function optOutRequest(token = TOKEN_A) {
  const form = new FormData();
  form.set("lang", "sv");
  return new Request(`https://www.proffera.se/api/marketplace/guest-quote/${token}/opt-out`, {
    method: "POST",
    headers: { origin: "https://www.proffera.se" },
    body: form,
  });
}

function redirectStatus(response: Response) {
  const location = response.headers.get("location");
  expect(location).toBeTruthy();
  return new URL(location ?? "https://www.proffera.se").searchParams.get("status");
}

describe("marketplace guest route rate limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hashToken.mockImplementation((token: string) => token === TOKEN_B ? HASH_B : HASH_A);
    const attempts = new Map<string, number>();
    mocks.allowPublicSubmission.mockImplementation(async (input: { scope: string; identity: string; maxAttempts: number }) => {
      const key = `${input.scope}:${input.identity}`;
      const next = (attempts.get(key) ?? 0) + 1;
      attempts.set(key, next);
      return next <= input.maxAttempts;
    });
    mocks.submitQuote.mockResolvedValue({ ok: true, offerId: "offer-id" });
    mocks.suppressRecipient.mockResolvedValue({ ok: true });
    mocks.notifyCustomer.mockResolvedValue({ ok: true, code: "sent" });
  });

  it("isolates guest quote rate limits by hashed token", async () => {
    const statuses: Array<string | null> = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await postGuestQuote(quoteRequest(TOKEN_A), context(TOKEN_A));
      expect(response.status).toBe(303);
      statuses.push(redirectStatus(response));
    }

    expect(statuses.slice(0, 5)).toEqual(["sent", "sent", "sent", "sent", "sent"]);
    expect(statuses[5]).toBe("rate_limited");

    const tokenBResponse = await postGuestQuote(quoteRequest(TOKEN_B), context(TOKEN_B));
    expect(redirectStatus(tokenBResponse)).toBe("sent");
    expect(mocks.submitQuote).toHaveBeenCalledTimes(6);
    expect(mocks.allowPublicSubmission).toHaveBeenCalledWith(expect.objectContaining({
      scope: "marketplace-guest-quote",
      identity: HASH_A,
      maxAttempts: 5,
      windowSeconds: 30 * 60,
    }));
    expect(mocks.allowPublicSubmission).toHaveBeenCalledWith(expect.objectContaining({
      scope: "marketplace-guest-quote",
      identity: HASH_B,
      maxAttempts: 5,
      windowSeconds: 30 * 60,
    }));
  });

  it("notifies the customer only after a successful guest offer submission", async () => {
    const response = await postGuestQuote(quoteRequest(TOKEN_A), context(TOKEN_A));

    expect(redirectStatus(response)).toBe("sent");
    expect(mocks.notifyCustomer).toHaveBeenCalledWith({
      guestToken: TOKEN_A,
      baseUrl: "https://www.proffera.se",
    });
  });

  it("keeps the provider offer successful if customer notification fails", async () => {
    mocks.notifyCustomer.mockResolvedValueOnce({ ok: false, code: "email_provider" });

    const response = await postGuestQuote(quoteRequest(TOKEN_A), context(TOKEN_A));

    expect(redirectStatus(response)).toBe("sent");
    expect(mocks.submitQuote).toHaveBeenCalledTimes(1);
    expect(mocks.notifyCustomer).toHaveBeenCalledTimes(1);
  });

  it("isolates guest opt-out rate limits by hashed token", async () => {
    const statuses: Array<string | null> = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await postGuestOptOut(optOutRequest(TOKEN_A), context(TOKEN_A));
      expect(response.status).toBe(303);
      statuses.push(redirectStatus(response));
    }

    expect(statuses.slice(0, 3)).toEqual(["done", "done", "done"]);
    expect(statuses[3]).toBe("rate_limited");

    const tokenBResponse = await postGuestOptOut(optOutRequest(TOKEN_B), context(TOKEN_B));
    expect(redirectStatus(tokenBResponse)).toBe("done");
    expect(mocks.suppressRecipient).toHaveBeenCalledTimes(4);
    expect(mocks.allowPublicSubmission).toHaveBeenCalledWith(expect.objectContaining({
      scope: "marketplace-guest-opt-out",
      identity: HASH_A,
      maxAttempts: 3,
      windowSeconds: 60 * 60,
    }));
    expect(mocks.allowPublicSubmission).toHaveBeenCalledWith(expect.objectContaining({
      scope: "marketplace-guest-opt-out",
      identity: HASH_B,
      maxAttempts: 3,
      windowSeconds: 60 * 60,
    }));
  });

  it("rejects an impossible calendar date before submitting the guest offer", async () => {
    const response = await postGuestQuote(quoteRequest(TOKEN_A, "2026-02-30"), context(TOKEN_A));

    expect(response.status).toBe(303);
    expect(redirectStatus(response)).toBe("invalid");
    expect(mocks.submitQuote).not.toHaveBeenCalled();
    expect(mocks.notifyCustomer).not.toHaveBeenCalled();
  });

  it("maps a profile-revocation race to the normal closed guest state", async () => {
    mocks.submitQuote.mockRejectedValueOnce(new Error("marketplace_profile_ineligible"));

    const response = await postGuestQuote(quoteRequest(TOKEN_A), context(TOKEN_A));

    expect(response.status).toBe(303);
    expect(redirectStatus(response)).toBe("closed");
    expect(mocks.submitQuote).toHaveBeenCalledTimes(1);
    expect(mocks.notifyCustomer).not.toHaveBeenCalled();
  });
});
