import { describe, expect, it } from "vitest";

import {
  createVerifiedReviewToken,
  hashVerifiedReviewToken,
} from "../src/lib/verified-review-token";

describe("verified review tokens", () => {
  it("creates high-entropy base64url tokens", () => {
    const first = createVerifiedReviewToken();
    const second = createVerifiedReviewToken();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });

  it("stores only a deterministic SHA-256 hash", () => {
    const token = createVerifiedReviewToken();
    const hash = hashVerifiedReviewToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashVerifiedReviewToken(token)).toBe(hash);
    expect(hash).not.toContain(token);
    expect(hash).not.toBe(token);
  });
});
