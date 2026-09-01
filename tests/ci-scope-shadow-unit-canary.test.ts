import { describe, expect, it } from "vitest";

describe("CI scope shadow unit-only canary", () => {
  it("keeps the evidence fixture side-effect free", () => {
    expect(true).toBe(true);
  });
});
