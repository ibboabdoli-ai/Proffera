import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminForArea: vi.fn(),
  emailConfigured: vi.fn(),
  expireInvitation: vi.fn(),
  sendInvitation: vi.fn(),
}));

vi.mock("@/lib/admin-authorization", () => ({ getAdminForArea: mocks.getAdminForArea }));
vi.mock("@/features/email/marketplace-guest-invitation-email", () => ({
  marketplaceGuestInvitationEmailConfigured: mocks.emailConfigured,
}));
vi.mock("@/features/matching/marketplace-invitation-state", () => ({
  expirePastMarketplaceInvitation: mocks.expireInvitation,
}));
vi.mock("@/lib/marketplace-guest-quote", () => ({
  sendMarketplaceGuestQuoteInvitation: mocks.sendInvitation,
}));

import { POST } from "@/app/api/admin/marketplace/guest-invite/route";

const quoteRequestId = "11111111-1111-4111-8111-111111111111";
const profileId = "22222222-2222-4222-8222-222222222222";

function inviteRequest() {
  const form = new FormData();
  form.set("quoteRequestId", quoteRequestId);
  form.set("profileId", profileId);
  form.set("recipientEmail", "offert@rorfirma.se");
  form.set("confirmBusinessContact", "yes");
  form.set("wave", "1");
  form.set("matchScore", "90");
  form.set("matchReasons", JSON.stringify(["test"]));
  return new Request("https://www.proffera.se/api/admin/marketplace/guest-invite", {
    method: "POST",
    headers: { origin: "https://www.proffera.se" },
    body: form,
  });
}

function inviteStatus(response: Response) {
  const location = response.headers.get("location");
  expect(location).toBeTruthy();
  return new URL(location ?? "https://www.proffera.se").searchParams.get("invite");
}

describe("marketplace guest admin invite route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdminForArea.mockResolvedValue({ userId: "admin-user" });
    mocks.emailConfigured.mockReturnValue(true);
    mocks.expireInvitation.mockResolvedValue(undefined);
    mocks.sendInvitation.mockResolvedValue({ ok: true, invitationId: "invite-id" });
  });

  it("does not reserve or mutate an invitation when Brevo is not configured", async () => {
    mocks.emailConfigured.mockReturnValue(false);

    const response = await POST(inviteRequest());

    expect(response.status).toBe(303);
    expect(inviteStatus(response)).toBe("email_configuration");
    expect(mocks.expireInvitation).not.toHaveBeenCalled();
    expect(mocks.sendInvitation).not.toHaveBeenCalled();
  });

  it("continues with expiry cleanup and delivery only when email configuration exists", async () => {
    const response = await POST(inviteRequest());

    expect(response.status).toBe(303);
    expect(inviteStatus(response)).toBe("sent");
    expect(mocks.expireInvitation).toHaveBeenCalledWith(quoteRequestId, profileId);
    expect(mocks.sendInvitation).toHaveBeenCalledTimes(1);
  });
});
