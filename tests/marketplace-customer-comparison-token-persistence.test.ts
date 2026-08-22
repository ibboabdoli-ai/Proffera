import { beforeEach, describe, expect, it, vi } from "vitest";

const TEST_COMPARISON_SECRET = "test-marketplace-customer-comparison-secret";

const mocks = vi.hoisted(() => ({
  dispatchToken: "44444444-4444-4444-8444-444444444444",
  getSql: vi.fn(),
  sendComparisonEmail: vi.fn(),
  hashGuestToken: vi.fn(),
  validGuestToken: vi.fn(),
  customerPortalSecret: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("node:crypto", async () => {
  const actual = await vi.importActual<typeof import("node:crypto")>("node:crypto");
  return {
    ...actual,
    randomUUID: () => mocks.dispatchToken,
  };
});
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/auth-secret", () => ({ resolveCustomerPortalSecret: mocks.customerPortalSecret }));
vi.mock("@/features/email/marketplace-customer-comparison-email", () => ({
  sendMarketplaceCustomerComparisonEmail: mocks.sendComparisonEmail,
}));
vi.mock("@/lib/marketplace-guest-quote", () => ({
  hashMarketplaceGuestToken: mocks.hashGuestToken,
}));
vi.mock("@/lib/marketplace-guest-opt-out-core", () => ({
  isValidMarketplaceGuestToken: mocks.validGuestToken,
}));

import {
  deriveMarketplaceCustomerComparisonToken,
  hashMarketplaceCustomerComparisonToken,
  notifyMarketplaceCustomerOfferAvailableFromGuestToken,
} from "@/lib/marketplace-customer-comparison";

function sqlResponses(...responses: unknown[][]) {
  let index = 0;
  return vi.fn(async () => responses[index++] ?? []);
}

function queryValues(call: unknown[] | undefined) {
  return call?.slice(1) ?? [];
}

describe("marketplace customer comparison token persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validGuestToken.mockReturnValue(true);
    mocks.hashGuestToken.mockReturnValue("guest-token-hash");
    mocks.customerPortalSecret.mockReturnValue(TEST_COMPARISON_SECRET);
  });

  it("persists the exact emailed token hash before the first comparison email", async () => {
    const quoteRequestId = "11111111-1111-4111-8111-111111111111";
    const expectedToken = deriveMarketplaceCustomerComparisonToken({
      quoteRequestId,
      dispatchToken: mocks.dispatchToken,
      secret: TEST_COMPARISON_SECRET,
    });
    const expectedHash = hashMarketplaceCustomerComparisonToken(expectedToken);
    const sql = sqlResponses(
      [{
        quote_request_id: quoteRequestId,
        reference_id: "PRO-123",
        contact_name: "Anna",
        contact_email: "anna@example.se",
      }],
      [{
        quote_request_id: quoteRequestId,
        token_hash: expectedHash,
        dispatch_token: mocks.dispatchToken,
      }],
      [{ quote_request_id: quoteRequestId }],
    );
    mocks.getSql.mockReturnValue(sql);
    mocks.sendComparisonEmail.mockResolvedValue({ ok: true, providerMessageId: "brevo-1" });

    const result = await notifyMarketplaceCustomerOfferAvailableFromGuestToken({
      guestToken: "g".repeat(43),
      baseUrl: "https://www.proffera.se/offert/svara/token",
    });

    expect(result).toEqual({ ok: true, code: "sent" });
    const comparisonUrl = String(mocks.sendComparisonEmail.mock.calls[0]?.[0]?.comparisonUrl ?? "");
    const emailedToken = comparisonUrl.split("/").at(-1) ?? "";
    expect(emailedToken).toBe(expectedToken);
    expect(hashMarketplaceCustomerComparisonToken(emailedToken)).toBe(expectedHash);
    expect(queryValues(sql.mock.calls[1])).toContain(expectedHash);
    expect(queryValues(sql.mock.calls[1])).toContain(mocks.dispatchToken);
    expect(mocks.sendComparisonEmail).toHaveBeenCalledWith(expect.objectContaining({
      comparisonUrl: `https://www.proffera.se/offert/jamfor/${expectedToken}`,
      idempotencyKey: mocks.dispatchToken,
    }));
  });
});
