import { describe, expect, it } from "vitest";

import { selectWorkspaceMembership } from "./workspace-access-selection";

const memberships = [
  { workspaceId: "workspace-a", role: "owner" },
  { workspaceId: "workspace-b", role: "staff" },
] as const;

describe("workspace membership selection", () => {
  it("selects a workspace only when it belongs to the authenticated membership set", () => {
    expect(selectWorkspaceMembership(memberships, "workspace-b")).toEqual(memberships[1]);
  });

  it("falls back to an owned workspace when a cookie requests an unowned workspace", () => {
    expect(selectWorkspaceMembership(memberships, "workspace-secret-other-customer")).toEqual(memberships[0]);
  });

  it("fails closed when there are no memberships", () => {
    expect(selectWorkspaceMembership([], "workspace-a")).toBeNull();
  });
});
