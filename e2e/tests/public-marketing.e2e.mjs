import { expect, test } from "@playwright/test";

test.describe("public marketing smoke", () => {
  test("Swedish root renders the primary customer-flow message", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.ok()).toBeTruthy();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Visa dina tjänster. Få in kunder. Hantera hela jobbet i Proffera.",
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Starta gratis i 14 dagar" }).first()).toBeVisible();
  });

  test("English root renders the matching English customer-flow message", async ({ page }) => {
    const response = await page.goto("/en");

    expect(response?.ok()).toBeTruthy();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Show your services. Win customers. Manage the whole job in Proffera.",
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Start free 14-day trial" }).first()).toBeVisible();
  });
});
