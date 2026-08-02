import { describe, expect, it } from "vitest";

import {
  canTransitionWorkspaceQuote,
  isWorkspaceQuoteStatus,
  workspaceQuoteStatuses,
} from "./workspace-quote-policy";

describe("workspace quote policy", () => {
  it("recognizes only supported statuses", () => {
    for (const status of workspaceQuoteStatuses) {
      expect(isWorkspaceQuoteStatus(status)).toBe(true);
    }

    expect(isWorkspaceQuoteStatus("matched")).toBe(false);
    expect(isWorkspaceQuoteStatus("completed")).toBe(false);
    expect(isWorkspaceQuoteStatus(null)).toBe(false);
  });

  it.each([
    ["submitted", "reviewing"],
    ["submitted", "cancelled"],
    ["reviewing", "quoted"],
    ["reviewing", "rejected"],
    ["quoted", "accepted"],
    ["quoted", "rejected"],
  ] as const)("allows %s -> %s", (from, to) => {
    expect(canTransitionWorkspaceQuote(from, to)).toBe(true);
  });

  it.each([
    ["submitted", "accepted"],
    ["reviewing", "accepted"],
    ["accepted", "quoted"],
    ["rejected", "reviewing"],
    ["cancelled", "submitted"],
  ] as const)("rejects %s -> %s", (from, to) => {
    expect(canTransitionWorkspaceQuote(from, to)).toBe(false);
  });
});
