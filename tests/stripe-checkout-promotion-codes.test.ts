import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  canManage: vi.fn(),
  sql: vi.fn(),
  sessionRetrieve: vi.fn(),
  sessionExpire: vi.fn(),
  sessionCreate: vi.fn(),
  customerRetrieve: vi.fn(),
  subscriptionRetrieve: vi.fn(),
}));

vi.mock("@/lib/db/server", () => ({ getSql: () => mocks.sql }));

vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: () => mocks.access(),
  canManageWorkspaceMembers: () => mocks.canManage(),
}));

vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({
    checkout: { sessions: {
      retrieve: mocks.sessionRetrieve,
      expire: mocks.sessionExpire,
      create: mocks.sessionCreate,
    } },
    customers: { retrieve: mocks.customerRetrieve },
    subscriptions: { retrieve: mocks.subscriptionRetrieve },
  }),
  getStripePriceIdForPlan: (plan: "starter" | "professional") =>
    plan === "starter" ? "price_starter" : "price_professional",
  isStripeAdaptivePricingEnabled: () => false,
  isStripeTaxEnabled: () => false,
}));

import { POST } from "../src/app/api/stripe/checkout/route";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";
const newSessionUrl = "https://checkout.stripe.com/c/pay/cs_test_new";
const oldSessionUrl = "https://checkout.stripe.com/c/pay/cs_test_old";

let checkoutSessionId: string | null;
let subscriptionId: string | null;
let savedPriceId: string;
let billingStatus: string;

function openSession(allowPromotionCodes: boolean | null) {
  return {
    status: "open",
    url: oldSessionUrl,
    allow_promotion_codes: allowPromotionCodes,
    metadata: {
      billing_country_code: "SE",
      billing_currency: "SEK",
      workspace_time_zone: "Europe/Stockholm",
    },
  };
}

async function postCheckout(planKey: string, origin = "https://www.proffera.se") {
  return POST(new Request("https://www.proffera.se/api/stripe/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ planKey, lang: "sv" }),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  checkoutSessionId = null;
  subscriptionId = null;
  savedPriceId = "price_starter";
  billingStatus = "pending";

  mocks.access.mockResolvedValue({ ok: true, workspaceId, userId: ownerId });
  mocks.canManage.mockReturnValue(true);
  mocks.sql.mockImplementation(async (parts: TemplateStringsArray) => {
    const query = parts.join(" ");
    if (query.includes("from workspace_billing_subscriptions")) {
      return [{
        stripe_customer_id: null,
        stripe_checkout_session_id: checkoutSessionId,
        stripe_subscription_id: subscriptionId,
        stripe_price_id: savedPriceId,
        status: billingStatus,
      }];
    }
    if (query.includes("from workspace_settings")) {
      return [{
        billing_country_code: "SE",
        billing_currency: "SEK",
        time_zone: "Europe/Stockholm",
      }];
    }
    if (query.includes("insert into workspace_billing_subscriptions")) return [];
    throw new Error("Unexpected checkout SQL query");
  });

  mocks.sessionCreate.mockResolvedValue({ id: "cs_test_new", url: newSessionUrl });
  mocks.sessionExpire.mockResolvedValue({ id: "cs_test_old", status: "expired" });
});

describe("subscription Checkout promotion-code entry", () => {
  it("allows Stripe-hosted promotion-code entry only for Starter", async () => {
    const result = await postCheckout("starter");

    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ url: newSessionUrl });
    expect(mocks.sessionCreate).toHaveBeenCalledOnce();
    expect(mocks.sessionCreate).toHaveBeenCalledWith(expect.objectContaining({
      mode: "subscription",
      allow_promotion_codes: true,
      line_items: [{ price: "price_starter", quantity: 1 }],
      client_reference_id: workspaceId,
      subscription_data: expect.objectContaining({
        metadata: expect.objectContaining({
          workspace_id: workspaceId,
          plan_key: "starter",
        }),
      }),
    }));
    expect(mocks.sessionCreate.mock.calls[0]?.[0]).not.toHaveProperty("discounts");
    expect(mocks.sessionExpire).not.toHaveBeenCalled();
  });

  it("does not expose promotion-code entry on Professional checkout", async () => {
    savedPriceId = "price_professional";

    const result = await postCheckout("professional");

    expect(result.status).toBe(200);
    expect(mocks.sessionCreate).toHaveBeenCalledWith(expect.objectContaining({
      line_items: [{ price: "price_professional", quantity: 1 }],
      allow_promotion_codes: false,
    }));
  });

  it("expires an old Starter session that cannot accept promotion codes", async () => {
    checkoutSessionId = "cs_test_old";
    mocks.sessionRetrieve.mockResolvedValue(openSession(null));

    const result = await postCheckout("starter");

    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ url: newSessionUrl });
    expect(mocks.sessionRetrieve).toHaveBeenCalledWith("cs_test_old");
    expect(mocks.sessionExpire).toHaveBeenCalledWith("cs_test_old");
    expect(mocks.sessionCreate).toHaveBeenCalledWith(expect.objectContaining({
      allow_promotion_codes: true,
    }));
  });

  it("reuses a matching Starter session that already accepts promotion codes", async () => {
    checkoutSessionId = "cs_test_old";
    mocks.sessionRetrieve.mockResolvedValue(openSession(true));

    const result = await postCheckout("starter");

    expect(await result.json()).toEqual({ url: oldSessionUrl });
    expect(mocks.sessionExpire).not.toHaveBeenCalled();
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });

  it("preserves reuse of an old Professional session without promotion codes", async () => {
    checkoutSessionId = "cs_test_old";
    savedPriceId = "price_professional";
    mocks.sessionRetrieve.mockResolvedValue(openSession(null));

    const result = await postCheckout("professional");

    expect(await result.json()).toEqual({ url: oldSessionUrl });
    expect(mocks.sessionExpire).not.toHaveBeenCalled();
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });

  it("expires a mismatched Professional session that allows codes", async () => {
    checkoutSessionId = "cs_test_old";
    savedPriceId = "price_professional";
    mocks.sessionRetrieve.mockResolvedValue(openSession(true));

    const result = await postCheckout("professional");

    expect(await result.json()).toEqual({ url: newSessionUrl });
    expect(mocks.sessionExpire).toHaveBeenCalledWith("cs_test_old");
    expect(mocks.sessionCreate).toHaveBeenCalledWith(expect.objectContaining({
      allow_promotion_codes: false,
    }));
  });

  it("fails closed if an old session cannot be expired due to a concurrent state change", async () => {
    checkoutSessionId = "cs_test_old";
    mocks.sessionRetrieve.mockResolvedValue(openSession(false));
    mocks.sessionExpire.mockRejectedValue(Object.assign(new Error("Session no longer expirable"), {
      type: "StripeInvalidRequestError",
      code: "checkout_session_not_expirable",
    }));
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    try {
      const result = await postCheckout("starter");
      expect(result.status).toBe(500);
      expect(mocks.sessionCreate).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });

  it("keeps the existing active-subscription guard", async () => {
    subscriptionId = "sub_existing";
    billingStatus = "active";
    mocks.subscriptionRetrieve.mockResolvedValue({ id: "sub_existing" });

    const result = await postCheckout("starter");

    expect(result.status).toBe(409);
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
  });

  it("denies non-owners and cross-origin requests before creating checkout", async () => {
    mocks.canManage.mockReturnValue(false);
    expect((await postCheckout("starter")).status).toBe(403);
    mocks.canManage.mockReturnValue(true);
    expect((await postCheckout("starter", "https://evil.example")).status).toBe(403);
    expect(mocks.sessionCreate).not.toHaveBeenCalled();
    expect(mocks.sql).not.toHaveBeenCalled();
  });
});
