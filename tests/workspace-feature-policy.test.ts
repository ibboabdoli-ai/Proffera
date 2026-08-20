import { describe, expect, it } from "vitest";

import { isWorkspacePlanFeatureIncluded } from "../src/lib/workspace-feature-policy";

const now = new Date("2026-08-06T09:00:00.000Z");

describe("workspace feature plan policy", () => {
  it("grants every catalog tier during an active workspace trial on a supported plan", () => {
    for (const minimumPlan of ["starter", "professional", "business"]) {
      expect(isWorkspacePlanFeatureIncluded({
        planKey: "starter",
        planStatus: "trialing",
        planPeriodEnd: "2026-08-20T09:00:00.000Z",
        minimumPlan,
        now,
      })).toBe(true);
    }
  });

  it("rejects trial records without a supported plan key", () => {
    for (const planKey of [null, "", "free", "unknown"]) {
      expect(isWorkspacePlanFeatureIncluded({
        planKey,
        planStatus: "trialing",
        planPeriodEnd: "2026-08-20T09:00:00.000Z",
        minimumPlan: "starter",
        now,
      })).toBe(false);
    }
  });

  it("stops full access when the workspace trial expires", () => {
    expect(isWorkspacePlanFeatureIncluded({
      planKey: "starter",
      planStatus: "trialing",
      planPeriodEnd: "2026-08-05T09:00:00.000Z",
      minimumPlan: "starter",
      now,
    })).toBe(false);
  });

  it("uses plan rank after trial for internal active plans without an expiry", () => {
    expect(isWorkspacePlanFeatureIncluded({
      planKey: "starter",
      planStatus: "active",
      planPeriodEnd: null,
      minimumPlan: "starter",
      now,
    })).toBe(true);

    expect(isWorkspacePlanFeatureIncluded({
      planKey: "starter",
      planStatus: "active",
      planPeriodEnd: null,
      minimumPlan: "professional",
      now,
    })).toBe(false);

    expect(isWorkspacePlanFeatureIncluded({
      planKey: "business",
      planStatus: "active",
      planPeriodEnd: null,
      minimumPlan: "professional",
      now,
    })).toBe(true);
  });

  it("keeps an active paid plan entitled while its finite billing period is current", () => {
    expect(isWorkspacePlanFeatureIncluded({
      planKey: "professional",
      planStatus: "active",
      planPeriodEnd: "2026-08-20T09:00:00.000Z",
      minimumPlan: "starter",
      now,
    })).toBe(true);
  });

  it("fails closed when an active plan's finite billing period is expired or malformed", () => {
    for (const planPeriodEnd of ["2026-08-05T09:00:00.000Z", "not-a-date", ""]) {
      expect(isWorkspacePlanFeatureIncluded({
        planKey: "professional",
        planStatus: "active",
        planPeriodEnd,
        minimumPlan: "starter",
        now,
      })).toBe(false);
    }
  });

  it("denies inactive plans", () => {
    expect(isWorkspacePlanFeatureIncluded({
      planKey: "business",
      planStatus: "canceled",
      planPeriodEnd: null,
      minimumPlan: "starter",
      now,
    })).toBe(false);
  });
});
