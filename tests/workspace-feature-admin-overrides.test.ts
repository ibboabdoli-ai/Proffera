import { describe, expect, it } from "vitest";

import { resolveWorkspaceFeatureAccess } from "../src/lib/workspace-feature-access";

describe("workspace feature admin overrides", () => {
  it("allows a platform-admin grant to bypass the plan gate", () => {
    expect(resolveWorkspaceFeatureAccess({
      includedInPlan: false,
      trialActive: false,
      workspaceEnabled: true,
      adminOverrideEnabled: true,
    })).toEqual({ hasAccess: true, accessState: "included" });
  });

  it("allows a platform-admin block to override plan access", () => {
    expect(resolveWorkspaceFeatureAccess({
      includedInPlan: true,
      trialActive: false,
      workspaceEnabled: true,
      adminOverrideEnabled: false,
    })).toEqual({ hasAccess: false, accessState: "disabled" });
  });

  it("preserves normal plan and workspace behavior without an override", () => {
    expect(resolveWorkspaceFeatureAccess({
      includedInPlan: true,
      trialActive: false,
      workspaceEnabled: true,
      adminOverrideEnabled: null,
    })).toEqual({ hasAccess: true, accessState: "included" });

    expect(resolveWorkspaceFeatureAccess({
      includedInPlan: true,
      trialActive: false,
      workspaceEnabled: false,
      adminOverrideEnabled: null,
    })).toEqual({ hasAccess: false, accessState: "disabled" });

    expect(resolveWorkspaceFeatureAccess({
      includedInPlan: false,
      trialActive: false,
      workspaceEnabled: true,
      adminOverrideEnabled: null,
    })).toEqual({ hasAccess: false, accessState: "locked" });
  });
});
