import { expect, test } from "@playwright/test";

test("CI scope shadow e2e-only canary is side-effect free", async () => {
  expect(true).toBe(true);
});
