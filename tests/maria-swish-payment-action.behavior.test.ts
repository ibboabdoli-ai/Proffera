import { beforeEach, describe, expect, it, vi } from "vitest";

const helpers = vi.hoisted(() => ({ save: vi.fn(), revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => { throw new Error("TEST_REDIRECT:" + url); },
}));
vi.mock("next/cache", () => ({ revalidatePath: helpers.revalidatePath }));
vi.mock("@/lib/maria-manual-swish", () => ({
  setMariaManualSwishStatus: helpers.save,
}));

import { recordMariaSwishPaymentAction } from "@/app/dashboard/maria/payment-actions";

const bookingId = "00000000-0000-4000-8000-000000000123";

function form(state: string, checked = false) {
  const data = new FormData();
  data.set("return_to", "detail");
  data.set("payment_state", state);
  if (checked) data.set("swish_checked", "on");
  return data;
}

beforeEach(() => {
  helpers.save.mockReset().mockResolvedValue({ changed: true });
  helpers.revalidatePath.mockClear();
});

describe("Maria manual Swish action: explicit paid confirmation", () => {
  it("rejects a paid mark unless the manager explicitly checked Swish", async () => {
    await expect(recordMariaSwishPaymentAction(bookingId, form("paid")))
      .rejects.toThrow(`TEST_REDIRECT:/dashboard/bokningar/${bookingId}?payment_error=verify`);
    expect(helpers.save).not.toHaveBeenCalled();
  });

  it("writes only when the manager explicitly confirmed Swish", async () => {
    await expect(recordMariaSwishPaymentAction(bookingId, form("paid", true)))
      .rejects.toThrow(`TEST_REDIRECT:/dashboard/bokningar/${bookingId}?payment_saved=paid`);
    expect(helpers.save).toHaveBeenCalledExactlyOnceWith(bookingId, "paid");
    expect(helpers.revalidatePath).toHaveBeenCalledWith("/dashboard/bokningar");
  });

  it("never writes a payment event for an invalid booking identifier", async () => {
    await expect(recordMariaSwishPaymentAction("../invalid", form("paid", true)))
      .rejects.toThrow("TEST_REDIRECT:/dashboard/bokningar?payment_error=save");
    expect(helpers.save).not.toHaveBeenCalled();
  });

  it("allows reversing a paid mark without claiming any bank verification", async () => {
    await expect(recordMariaSwishPaymentAction(bookingId, form("unverified")))
      .rejects.toThrow(`TEST_REDIRECT:/dashboard/bokningar/${bookingId}?payment_saved=unverified`);
    expect(helpers.save).toHaveBeenCalledExactlyOnceWith(bookingId, "unverified");
  });
});
