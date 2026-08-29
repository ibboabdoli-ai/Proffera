import { describe, expect, it } from "vitest";

import { workflowCronExpressions, workflowTriggers } from "./github-workflow-yaml";

describe("GitHub workflow YAML parser contracts", () => {
  it("rejects missing or non-record on mappings", () => {
    expect(() => workflowTriggers("name: Missing triggers\n")).toThrow(
      "GitHub workflow must define an 'on' trigger mapping",
    );
    expect(() => workflowTriggers("on: true\n")).toThrow(
      "GitHub workflow must define an 'on' trigger mapping",
    );
  });

  it("rejects a non-array on.schedule value", () => {
    expect(() => workflowCronExpressions("on:\n  schedule: invalid\n")).toThrow(
      "GitHub workflow on.schedule must be an array",
    );
  });

  it("rejects schedule entries whose cron is not a string", () => {
    expect(() => workflowCronExpressions("on:\n  schedule:\n    - cron: 17\n")).toThrow(
      "GitHub workflow schedule entries must contain a cron string",
    );
  });

  it("accepts valid trigger mappings and returns an empty schedule when omitted", () => {
    expect(workflowTriggers("on:\n  workflow_dispatch:\n")).toHaveProperty("workflow_dispatch");
    expect(workflowCronExpressions("on:\n  workflow_dispatch:\n")).toEqual([]);
    expect(workflowCronExpressions("on:\n  schedule:\n    - cron: '17 * * * *'\n")).toEqual([
      "17 * * * *",
    ]);
  });
});
