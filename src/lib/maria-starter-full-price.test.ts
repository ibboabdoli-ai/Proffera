import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getSql: vi.fn(), getClient: vi.fn(), getPrice: vi.fn(), evaluate: vi.fn(), sync: vi.fn(),
}));
vi.mock("server-only",()=>({}));
vi.mock("@/lib/db/server",()=>({getSql:mocks.getSql}));
vi.mock("@/lib/stripe",()=>({getStripeClient:mocks.getClient,getStripePriceIdForPlan:mocks.getPrice}));
vi.mock("@/lib/maria-starter-full-price-policy",()=>({getStarterFullPriceQuote:mocks.evaluate}));
vi.mock("@/lib/workspace-billing",()=>({syncWorkspaceSubscription:mocks.sync}));
import { acceptMariaStarterFullPrice } from "./maria-starter-full-price";

const quote = { subscriptionId:"sub_synthetic",discountId:"di_synthetic",periodEnd:1900000000,
  nextAmountOre:29900,currentAmountOre:15000,currency:"sek" };
const subscription = { id:"sub_synthetic",status:"active", discounts:[],pending_update:null,
  metadata:{workspace_id:"ws_synthetic"},
  customer:"cus_synthetic",items:{data:[{price:{id:"price_starter",tax_behavior:"inclusive"}}]} };
const approved={workspaceId:"ws_synthetic",userId:"owner",subscriptionId:"sub_synthetic",
  discountId:"di_synthetic",periodEnd:1900000000,nextAmountOre:29900,
  acknowledged:true,confirmation:"CONFIRM 299 SEK"};
describe("safe same-subscription Starter coupon removal", () => {
  const retrieve=vi.fn(), update=vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSql.mockReturnValue(async()=>[{status:"active",plan_status:"active",plan_key:"starter",
      stripe_customer_id:"cus_synthetic",stripe_subscription_id:"sub_synthetic"}]);
    mocks.getClient.mockReturnValue({subscriptions:{retrieve,update}});
    mocks.getPrice.mockReturnValue("price_starter");
    mocks.evaluate.mockReturnValue(quote);
    mocks.sync.mockResolvedValue({ok:true});
    retrieve.mockResolvedValue(subscription);
    update.mockResolvedValue(subscription);
  });
  it("changes only discounts on SAME subscription with no proration or second subscription",async()=>{
    expect(await acceptMariaStarterFullPrice(approved)).toBe("updated");
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith("sub_synthetic",expect.objectContaining({
      discounts:"",proration_behavior:"none",
      metadata:expect.objectContaining({starter_full_price_prior_discount_id:"di_synthetic",
        starter_full_price_effective_at:"1900000000",starter_full_price_approved_by:"owner"}),
    }),expect.objectContaining({idempotencyKey:expect.stringContaining("sub_synthetic")}));
    expect(mocks.sync).toHaveBeenCalledTimes(1);
  });
  it("refuses to claim upgrade success if Stripe did not remove coupon",async()=>{
    update.mockResolvedValue({...subscription,discounts:[{id:"di_synthetic"}]});
    expect(await acceptMariaStarterFullPrice(approved)).toBe("error");
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("fails closed before Stripe writes when consent is missing or quote stale",async()=>{
    expect(await acceptMariaStarterFullPrice({...approved,acknowledged:false})).toBe("stale");
    mocks.evaluate.mockReturnValue({...quote,discountId:"di_other"});
    expect(await acceptMariaStarterFullPrice(approved)).toBe("stale");
    expect(update).not.toHaveBeenCalled();
  });
});
