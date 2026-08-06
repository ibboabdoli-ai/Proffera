import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => {
  const auditValues: unknown[][] = [];
  const sql = vi.fn((_: TemplateStringsArray, ...values: unknown[]) => {
    auditValues.push(values);
    return Promise.resolve([]);
  });

  return {
    auditValues,
    sql,
    issueReviewInvitation: vi.fn(),
    getReviewInvitationDashboardContext: vi.fn(),
    sendVerifiedReviewInvitationEmail: vi.fn(),
    getUserWorkspaceAccess: vi.fn(),
  };
});

vi.mock("@/lib/verified-review-invitations", () => ({
  issueReviewInvitation: mocks.issueReviewInvitation,
  getReviewInvitationDashboardContext: mocks.getReviewInvitationDashboardContext,
}));

vi.mock("@/features/email/verified-review-invitation-email", () => ({
  sendVerifiedReviewInvitationEmail: mocks.sendVerifiedReviewInvitationEmail,
}));

vi.mock("@/lib/db/server", () => ({
  getSql: () => mocks.sql,
}));

vi.mock("@/lib/workspace-access", () => ({
  getUserWorkspaceAccess: mocks.getUserWorkspaceAccess,
  canManageWorkspaceSettings: () => true,
}));

import {
  issueAndDeliverReviewInvitation,
  resolveVerifiedReviewOrigin,
} from "./verified-review-delivery";

const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
const originalAuthUrl = process.env.BETTER_AUTH_URL;

function restoreEnvironment(name: "NEXT_PUBLIC_APP_URL" | "BETTER_AUTH_URL", value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.BETTER_AUTH_URL;
  mocks.auditValues.length = 0;
  mocks.sql.mockClear();
  mocks.issueReviewInvitation.mockReset().mockResolvedValue({
    ok: true,
    token: "private-token-123",
    bookingId: "11111111-1111-4111-8111-111111111111",
    bookingTitle: "Window cleaning",
    customerName: "Ada Lovelace",
    customerEmail: "ada@example.com",
    expiresAt: "2026-08-31T12:00:00.000Z",
  });
  mocks.getReviewInvitationDashboardContext.mockReset().mockResolvedValue({
    companyName: "Nordic Service AB",
    timeZone: "Europe/Stockholm",
    language: "en",
    primaryColor: "#17452f",
    accentColor: "#d8ae52",
    logoUrl: null,
    homeUrl: null,
  });
  mocks.sendVerifiedReviewInvitationEmail.mockReset().mockResolvedValue({
    ok: true,
    providerMessageId: "provider-123",
  });
  mocks.getUserWorkspaceAccess.mockReset().mockResolvedValue({
    ok: true,
    userId: "user-123",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    workspaceName: "Nordic Service AB",
    role: "owner",
  });
});

afterEach(() => {
  restoreEnvironment("NEXT_PUBLIC_APP_URL", originalAppUrl);
  restoreEnvironment("BETTER_AUTH_URL", originalAuthUrl);
});

describe("verified review delivery", () => {
  it("uses only configured origins and rejects a hostile request host", () => {
    expect(resolveVerifiedReviewOrigin("https://attacker.example/api/dashboard/review-invitations"))
      .toBe("https://www.proffera.se");

    process.env.NEXT_PUBLIC_APP_URL = "https://reviews.proffera.se/path";
    expect(resolveVerifiedReviewOrigin("https://attacker.example/route"))
      .toBe("https://reviews.proffera.se");

    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(resolveVerifiedReviewOrigin("http://localhost:3000/api/dashboard/review-invitations"))
      .toBe("http://localhost:3000");
  });

  it("sends the invitation and audits only delivery metadata", async () => {
    const result = await issueAndDeliverReviewInvitation(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(result).toMatchObject({
      ok: true,
      reviewUrl: "https://www.proffera.se/review/private-token-123",
      delivery: { status: "sent", providerMessageId: "provider-123" },
    });
    expect(mocks.sendVerifiedReviewInvitationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        customerEmail: "ada@example.com",
        reviewUrl: "https://www.proffera.se/review/private-token-123",
        language: "en",
      }),
    );

    const auditPayload = JSON.stringify(mocks.auditValues);
    expect(auditPayload).toContain("website_review.invitation_email_sent");
    expect(auditPayload).toContain("provider-123");
    expect(auditPayload).not.toContain("private-token-123");
    expect(auditPayload).not.toContain("ada@example.com");
  });

  it("keeps the raw link available when the customer has no email", async () => {
    mocks.issueReviewInvitation.mockResolvedValueOnce({
      ok: true,
      token: "private-token-456",
      bookingId: "11111111-1111-4111-8111-111111111111",
      bookingTitle: "Window cleaning",
      customerName: "Ada Lovelace",
      customerEmail: null,
      expiresAt: "2026-08-31T12:00:00.000Z",
    });

    const result = await issueAndDeliverReviewInvitation(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(result).toMatchObject({
      ok: true,
      reviewUrl: "https://www.proffera.se/review/private-token-456",
      delivery: { status: "missing_email", providerMessageId: null },
    });
    expect(mocks.sendVerifiedReviewInvitationEmail).not.toHaveBeenCalled();
    expect(JSON.stringify(mocks.auditValues)).not.toContain("private-token-456");
  });

  it("returns the new link when Brevo fails so the manager can retry manually", async () => {
    mocks.sendVerifiedReviewInvitationEmail.mockResolvedValueOnce({
      ok: false,
      code: "provider",
    });

    const result = await issueAndDeliverReviewInvitation(
      "11111111-1111-4111-8111-111111111111",
    );

    expect(result).toMatchObject({
      ok: true,
      reviewUrl: "https://www.proffera.se/review/private-token-123",
      delivery: { status: "failed", providerMessageId: null },
    });
    expect(JSON.stringify(mocks.auditValues)).toContain("provider");
    expect(JSON.stringify(mocks.auditValues)).not.toContain("private-token-123");
  });

  it("forwards invitation eligibility failures without sending email", async () => {
    mocks.issueReviewInvitation.mockResolvedValueOnce({
      ok: false,
      code: "invalid_booking",
    });

    await expect(
      issueAndDeliverReviewInvitation("11111111-1111-4111-8111-111111111111"),
    ).resolves.toEqual({ ok: false, code: "invalid_booking" });
    expect(mocks.sendVerifiedReviewInvitationEmail).not.toHaveBeenCalled();
    expect(mocks.sql).not.toHaveBeenCalled();
  });
});
