import { describe, expect, it } from "vitest";

import { primeViewReviewSchema } from "../src/features/primeview/review";

const validReview = {
  reviewerName: "Alex Morgan",
  rating: 5,
  service: "Gutter Cleaning",
  area: "NW1",
  message: "Arrived on time and left the gutters completely clear.",
  consent: true,
  website: "",
  formStartedAt: Date.now(),
};

describe("PrimeView review schema", () => {
  it("accepts a review that is ready for moderation", () => {
    expect(primeViewReviewSchema.safeParse(validReview).success).toBe(true);
  });

  it("requires a valid star rating and publication consent", () => {
    expect(primeViewReviewSchema.safeParse({ ...validReview, rating: 6 }).success).toBe(false);
    expect(primeViewReviewSchema.safeParse({ ...validReview, consent: false }).success).toBe(false);
  });

  it("normalizes empty optional details to null", () => {
    const parsed = primeViewReviewSchema.parse({ ...validReview, service: "  ", area: "" });

    expect(parsed.service).toBeNull();
    expect(parsed.area).toBeNull();
  });
});
