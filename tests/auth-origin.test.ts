import { describe, expect, it } from "vitest";

import { resolvePreviewAuthOriginConfig } from "../src/lib/auth-origin";

const testEnvironment = {
  NODE_ENV: "test",
} as NodeJS.ProcessEnv;

describe("Preview auth origin resolution", () => {
  it("does not override auth origins outside Vercel Preview", () => {
    expect(
      resolvePreviewAuthOriginConfig({
        ...testEnvironment,
        VERCEL_ENV: "production",
        VERCEL_URL: "proffera-jhap-production-wzardmn.vercel.app",
      }),
    ).toBeNull();
  });

  it("trusts only the exact Vercel deployment and branch hosts in Preview", () => {
    expect(
      resolvePreviewAuthOriginConfig({
        ...testEnvironment,
        VERCEL_ENV: "preview",
        VERCEL_URL: "proffera-jhap-ghvtrc9be-wzardmn.vercel.app",
        VERCEL_BRANCH_URL: "proffera-jhap-git-fix-preview-auth-secret-wzardmn.vercel.app",
        BETTER_AUTH_URL: "https://www.proffera.se",
      }),
    ).toEqual({
      baseURL: {
        allowedHosts: [
          "proffera-jhap-ghvtrc9be-wzardmn.vercel.app",
          "proffera-jhap-git-fix-preview-auth-secret-wzardmn.vercel.app",
        ],
        protocol: "https",
      },
      trustedOrigins: [
        "https://proffera-jhap-ghvtrc9be-wzardmn.vercel.app",
        "https://proffera-jhap-git-fix-preview-auth-secret-wzardmn.vercel.app",
      ],
    });
  });

  it("deduplicates matching deployment and branch hosts", () => {
    expect(
      resolvePreviewAuthOriginConfig({
        ...testEnvironment,
        VERCEL_ENV: "preview",
        VERCEL_URL: "same-preview-wzardmn.vercel.app",
        VERCEL_BRANCH_URL: "https://same-preview-wzardmn.vercel.app",
      }),
    ).toEqual({
      baseURL: {
        allowedHosts: ["same-preview-wzardmn.vercel.app"],
        protocol: "https",
      },
      trustedOrigins: ["https://same-preview-wzardmn.vercel.app"],
    });
  });

  it("fails closed when Preview has no valid Vercel host", () => {
    expect(() =>
      resolvePreviewAuthOriginConfig({
        ...testEnvironment,
        VERCEL_ENV: "preview",
        VERCEL_URL: "https://www.proffera.se",
        VERCEL_BRANCH_URL: "not a host",
      }),
    ).toThrow(/VERCEL_URL or VERCEL_BRANCH_URL/);
  });
});
