import { expect, test } from "@playwright/test";

test.describe("public marketplace smoke", () => {
  test("Swedish root renders customer marketplace search and business escape hatch", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.ok()).toBeTruthy();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Vad behöver du hjälp med?",
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Sök" })).toBeVisible();
    await expect(page.getByRole("link", { name: "För företag" }).first()).toBeVisible();
  });

  test("English root renders matching customer marketplace search and business escape hatch", async ({ page }) => {
    const response = await page.goto("/en");

    expect(response?.ok()).toBeTruthy();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "What do you need help with?",
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible();
    await expect(page.getByRole("link", { name: "For businesses" }).first()).toBeVisible();
  });
});
