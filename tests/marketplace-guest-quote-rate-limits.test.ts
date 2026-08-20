import { beforeEach, describe, expect, it, vi } from "vitest";

// Rate-limit buckets must remain isolated per hashed guest token.
const HASHED_IDENTITY = "a".repeat(64);
const mocks = vi.hoisted(() => ({
  allowPublicSubmission: vi.fn(),
  hashToken: vi.fn(() => "a".repeat(64)),
  submitQuote: vi.fn(),
  suppressRecipient: vi.fn(),
}));

vi.mock("@/lib/public-form-protection", () => ({
  allowPublicSubmission: mocks.allowPublicSubmission,
}));
vi.mock("@/lib/marketplace-guest-quote", () => ({
  hashMarketplaceGuestToken: mocks.hashToken,
  submitMarketplaceGuestQuote: mocks.submitQuote,
  suppressMarketplaceGuestRecipient: mocks.suppressRecipient,
}));

import { POST as postGuestQuote } from "@/app/api/marketplace/guest-quote/[token]/route";
import { POST as postGuestOptOut } from "@/app/api/marketplace/guest-quote/[token]/opt-out/route";

const token = "A".repeat(43);
const context = { params: Promise.resolve({ token }) };

function quoteRequest() {
  const form = new FormData();
  form.set("priceKind", "fixed");
  form.set("amountSek", "1800");
  form.set("confirmAuthority", "yes");
  form.set("lang", "sv");
  return new Request(`https://www.proffera.se/api/marketplace/guest-quote/${token}`, {
    method: "POST",
    headers: { origin: "https://www.proffera.se" },
    body: form,
  });
}

function optOutRequest() {
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
    const attempts = new Map<string, number>();
    mocks.allowPublicSubmission.mockImplementation(async (input: { scope: string; identity: string; maxAttempts: number }) => {
      const key = `${input.scope}:${input.identity}`;
      const next = (attempts.get(key) ?? 0) + 1;
      attempts.set(key, next);
      return next <= input.maxAttempts;
    });
    mocks.submitQuote.mockResolvedValue({ ok: true, offerId: "offer-id" });
    mocks.suppressRecipient.mockResolvedValue({ ok: true });
  });

  it("allows five guest quote submissions per token window and rejects the sixth", async () => {
    const statuses: Array<string | null> = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await postGuestQuote(quoteRequest(), context);
      expect(response.status).toBe(303);
      statuses.push(redirectStatus(response));
    }

    expect(statuses.slice(0, 5)).toEqual(["sent", "sent", "sent", "sent", "sent"]);
    expect(statuses[5]).toBe("rate_limited");
    expect(mocks.submitQuote).toHaveBeenCalledTimes(5);
    expect(mocks.hashToken).toHaveBeenCalledWith(token);
    expect(mocks.allowPublicSubmission).toHaveBeenLastCalledWith(expect.objectContaining({
      scope: "marketplace-guest-quote",
      identity: HASHED_IDENTITY,
      maxAttempts: 5,
      windowSeconds: 30 * 60,
    }));
  });

  it("allows three guest opt-outs per token window and rejects the fourth", async () => {
    const statuses: Array<string | null> = [];
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await postGuestOptOut(optOutRequest(), context);
      expect(response.status).toBe(303);
      statuses.push(redirectStatus(response));
    }

    expect(statuses.slice(0, 3)).toEqual(["done", "done", "done"]);
    expect(statuses[3]).toBe("rate_limited");
    expect(mocks.suppressRecipient).toHaveBeenCalledTimes(3);
    expect(mocks.hashToken).toHaveBeenCalledWith(token);
    expect(mocks.allowPublicSubmission).toHaveBeenLastCalledWith(expect.objectContaining({
      scope: "marketplace-guest-opt-out",
      identity: HASHED_IDENTITY,
      maxAttempts: 3,
      windowSeconds: 60 * 60,
    }));
  });
});
