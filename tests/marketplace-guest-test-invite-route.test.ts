import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPlatformAdmin: vi.fn(),
  sendTest: vi.fn(),
}));

vi.mock("@/lib/platform-admin", () => ({ getPlatformAdmin: mocks.getPlatformAdmin }));
vi.mock("@/lib/marketplace-guest-quote-test", () => ({
  sendMarketplaceGuestQuoteTestInvitation: mocks.sendTest,
}));

import { POST } from "@/app/api/admin/marketplace/guest-invite-test/route";

function testRequest(options?: { recipientEmail?: string; confirmed?: boolean; origin?: string }) {
  const form = new FormData();
  form.set("recipientEmail", options?.recipientEmail ?? "ibbo@company.test");
  if (options?.confirmed !== false) form.set("confirmControlledTestRecipient", "yes");
  return new Request("https://www.proffera.se/api/admin/marketplace/guest-invite-test", {
    method: "POST",
    headers: { origin: options?.origin ?? "https://www.proffera.se" },
    body: form,
  });
}

function testStatus(response: Response) {
  const location = response.headers.get("location");
  expect(location).toBeTruthy();
  return new URL(location ?? "https://www.proffera.se").searchParams.get("test");
}

describe("marketplace guest quote test invite route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPlatformAdmin.mockResolvedValue({ userId: "super-admin", role: "super_admin" });
    mocks.sendTest.mockResolvedValue({ ok: true });
  });

  it("is restricted to super admins", async () => {
    mocks.getPlatformAdmin.mockResolvedValue({ userId: "quote-admin", role: "operations_admin" });

    const response = await POST(testRequest());

    expect(response.status).toBe(403);
    expect(mocks.sendTest).not.toHaveBeenCalled();
  });

  it("requires a same-origin controlled-recipient confirmation before dispatch", async () => {
    const invalid = await POST(testRequest({ confirmed: false }));
    const crossOrigin = await POST(testRequest({ origin: "https://evil.example" }));

    expect(testStatus(invalid)).toBe("invalid");
    expect(crossOrigin.status).toBe(403);
    expect(mocks.sendTest).not.toHaveBeenCalled();
  });

  it("dispatches only the approved controlled test and reports its result", async () => {
    const response = await POST(testRequest());

    expect(testStatus(response)).toBe("sent");
    expect(mocks.sendTest).toHaveBeenCalledWith({
      adminUserId: "super-admin",
      recipientEmail: "ibbo@company.test",
      baseUrl: "https://www.proffera.se",
    });

    mocks.sendTest.mockResolvedValueOnce({ ok: false, code: "rate_limited" });
    expect(testStatus(await POST(testRequest()))).toBe("rate_limited");
  });
});
