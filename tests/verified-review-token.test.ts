import { describe, expect, it } from "vitest";

import {
  verifiedReviewSubmissionSchema,
  verifiedReviewTokenSchema,
} from "../src/features/reviews/verified-review";
import {
  createVerifiedReviewToken,
  hashVerifiedReviewToken,
} from "../src/lib/verified-review-token";

describe("verified review tokens", () => {
  it("creates a URL-safe high-entropy token and stores only its SHA-256 hash", () => {
    const token = createVerifiedReviewToken();
    const hash = hashVerifiedReviewToken(token);

    expect(verifiedReviewTokenSchema.safeParse(token).success).toBe(true);
    expect(token).toHaveLength(43);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain(token);
  });

  it("hashes the same token deterministically", () => {
    const token = createVerifiedReviewToken();
    expect(hashVerifiedReviewToken(token)).toBe(hashVerifiedReviewToken(token));
  });

  it("validates the customer review payload", () => {
    const result = verifiedReviewSubmissionSchema.safeParse({
      reviewerName: "Alex Morgan",
      rating: 5,
      message: "PrimeView arrived on time and completed the work carefully.",
      consent: true,
      website: "",
      formStartedAt: Date.now(),
    });

    expect(result.success).toBe(true);
    expect(
      verifiedReviewSubmissionSchema.safeParse({
        reviewerName: "A",
        rating: 6,
        message: "Too short",
        consent: false,
        website: "",
        formStartedAt: Date.now(),
      }).success,
    ).toBe(false);
  });
});
