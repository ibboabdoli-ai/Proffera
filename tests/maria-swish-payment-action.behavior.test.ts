import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ setPayment: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("next/navigation", () => ({
  redirect: (target: string): never => { throw new Error("REDIRECT:" + target); },
}));
vi.mock("@/lib/maria-manual-swish", () => ({
  setMariaManualSwishStatus: mocks.setPayment,
}));

import { recordMariaSwishPaymentAction } from "@/app/dashboard/maria/payment-actions";

const bookingId = "00000000-0000-4000-8000-000000000042";
const request = (state: string, checked = false) => {
  const data = new FormData();
  data.set("payment_state", state);
  if (checked) data.set("swish_checked", "on");
  return data;
};

describe("Maria manual Swish action confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setPayment.mockResolvedValue({ changed: true });
  });

  it("rejects a paid write without the human Swish confirmation", async () => {
    await expect(recordMariaSwishPaymentAction(bookingId, request("paid")))
      .rejects.toThrow("REDIRECT:/dashboard/bokningar?payment_error=verify");
    expect(mocks.setPayment).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("records a manually checked paid deposit exactly once", async () => {
    await expect(recordMariaSwishPaymentAction(bookingId, request("paid", true)))
      .rejects.toThrow("REDIRECT:/dashboard/bokningar?payment_saved=paid");
    expect(mocks.setPayment).toHaveBeenCalledExactlyOnceWith(bookingId, "paid");
    expect(mocks.revalidate).toHaveBeenCalledWith("/dashboard/bokningar");
  });

  it("allows reversing the manual mark without claiming a new payment", async () => {
    await expect(recordMariaSwishPaymentAction(bookingId, request("unverified")))
      .rejects.toThrow("REDIRECT:/dashboard/bokningar?payment_saved=unverified");
    expect(mocks.setPayment).toHaveBeenCalledExactlyOnceWith(bookingId, "unverified");
  });

  it("rejects malformed booking identifiers before any write", async () => {
    await expect(recordMariaSwishPaymentAction("invalid-id", request("paid", true)))
      .rejects.toThrow("REDIRECT:/dashboard/bokningar?payment_error=save");
    expect(mocks.setPayment).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
