import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  allowPublicSubmission: vi.fn(),
  hashReviewToken: vi.fn(),
  legacySubmit: vi.fn(),
  sendReviewEmail: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/public-form-protection", () => ({ allowPublicSubmission: mocks.allowPublicSubmission }));
vi.mock("@/lib/verified-review-token", () => ({
  createVerifiedReviewToken: vi.fn(),
  hashVerifiedReviewToken: mocks.hashReviewToken,
}));
vi.mock("@/lib/verified-review-invitations", () => ({ submitVerifiedReview: mocks.legacySubmit }));
vi.mock("@/features/email/review-invitation-email", () => ({ sendVerifiedReviewInvitationEmail: mocks.sendReviewEmail }));

import { POST } from "@/app/api/reviews/[token]/route";

const submission = {
  reviewerName: "Anna",
  rating: 5,
  message: "Bra jobb gjort",
  consent: true,
  website: "",
  formStartedAt: Date.now() - 10_000,
};

describe("Marketplace verified-review HTTP route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.allowPublicSubmission.mockResolvedValue(true);
    mocks.hashReviewToken.mockReturnValue("f".repeat(64));
  });

  it("maps a racing/failed Marketplace review insert to HTTP 503 without falling through to legacy review", async () => {
    const sql = vi.fn(async () => [{
      invitation_status: "pending",
      expires_at: "2099-01-01T00:00:00Z",
      job_status: "completed",
      review_exists: false,
      review_id: null,
      submitted: false,
    }]);
    mocks.getSql.mockReturnValue(sql);

    const response = await POST(
      new Request("https://www.proffera.se/api/reviews/" + "r".repeat(43), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(submission),
      }),
      { params: Promise.resolve({ token: "r".repeat(43) }) },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "The review could not be submitted right now." });
    expect(mocks.legacySubmit).not.toHaveBeenCalled();
  });
});
