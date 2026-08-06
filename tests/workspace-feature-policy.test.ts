import { describe, expect, it } from "vitest";

import { isWorkspacePlanFeatureIncluded } from "../src/lib/workspace-feature-policy";

const now = new Date("2026-08-06T09:00:00.000Z");

describe("workspace feature plan policy", () => {
  it("grants every catalog tier during an active workspace trial", () => {
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

  it("stops full access when the workspace trial expires", () => {
    expect(isWorkspacePlanFeatureIncluded({
      planKey: "starter",
      planStatus: "trialing",
      planPeriodEnd: "2026-08-05T09:00:00.000Z",
      minimumPlan: "starter",
      now,
    })).toBe(false);
  });

  it("uses plan rank after trial", () => {
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
