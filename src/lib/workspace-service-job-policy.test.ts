import { describe, expect, it } from "vitest";

import {
  canTransitionWorkspaceServiceJob,
  getWorkspaceServiceJobTransitions,
  isWorkspaceServiceJobStatus,
  workspaceServiceJobStatuses,
} from "./workspace-service-job-policy";

describe("workspace service job policy", () => {
  it("recognizes only declared service job statuses", () => {
    expect(isWorkspaceServiceJobStatus("new")).toBe(true);
    expect(isWorkspaceServiceJobStatus("accepted")).toBe(false);
  });

  it.each([
    ["new", "assigned"],
    ["new", "in_progress"],
    ["assigned", "in_progress"],
    ["in_progress", "completed"],
    ["in_progress", "cancelled"],
  ] as const)("allows %s -> %s", (from, to) => {
    expect(canTransitionWorkspaceServiceJob(from, to)).toBe(true);
  });

  it.each([
    ["new", "completed"],
    ["assigned", "completed"],
    ["completed", "in_progress"],
    ["cancelled", "new"],
  ] as const)("rejects %s -> %s", (from, to) => {
    expect(canTransitionWorkspaceServiceJob(from, to)).toBe(false);
  });

  it("makes terminal states immutable", () => {
    for (const status of workspaceServiceJobStatuses.filter((status) => ["completed", "cancelled"].includes(status))) {
      expect(getWorkspaceServiceJobTransitions(status)).toEqual([]);
    }
  });
});
