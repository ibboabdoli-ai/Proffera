import { createHash, createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSql: vi.fn(),
  resolveSecret: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getSql: mocks.getSql }));
vi.mock("@/lib/public-form-rate-limit-secret", () => ({
  resolvePublicFormRateLimitSecret: mocks.resolveSecret,
}));

import { allowPublicSubmission } from "@/lib/public-form-protection";

const request = {
  scope: "auth_password_reset_request",
  requestHeaders: new Headers({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" }),
  identity: " EXAMPLE ",
  maxAttempts: 5,
  windowSeconds: 900,
};

describe("existing public-form rate-limit bucket continuity", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.resolveSecret.mockReturnValue("synthetic-test-secret");
    mocks.sql.mockResolvedValue([{ attempts: 1 }]);
    mocks.getSql.mockReturnValue(mocks.sql);
  });

  it("preserves the exact pre-release SHA256 bucket key for existing counters", async () => {
    await expect(allowPublicSubmission(request)).resolves.toBe(true);
    const actual = mocks.sql.mock.calls[0]?.[2];
    const legacy = createHash("sha256")
      .update("synthetic-test-secret:auth_password_reset_request:203.0.113.10:example")
      .digest("hex");
    const incompatibleHmac = createHmac("sha256", "synthetic-test-secret")
      .update("auth_password_reset_request:203.0.113.10:example")
      .digest("hex");
    expect(actual).toBe(legacy);
    expect(actual).not.toBe(incompatibleHmac);
    expect(actual).not.toContain("synthetic-test-secret");
  });

  it("rejects a saturated legacy bucket without a fresh post-release quota", async () => {
    mocks.sql.mockResolvedValue([{ attempts: 6 }]);
    await expect(allowPublicSubmission(request)).resolves.toBe(false);
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });

  it("preserves isolation by normalized identity", async () => {
    await allowPublicSubmission({ ...request, identity: "one" });
    await allowPublicSubmission({ ...request, identity: "two" });
    expect(mocks.sql.mock.calls[0]?.[2]).not.toEqual(mocks.sql.mock.calls[1]?.[2]);
  });

  it("fails closed if the secret is missing", async () => {
    mocks.resolveSecret.mockReturnValue(null);
    await expect(allowPublicSubmission(request)).resolves.toBe(false);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
});
