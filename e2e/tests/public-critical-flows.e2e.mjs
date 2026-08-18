import { expect, test } from "@playwright/test";

test.describe("public critical-flow smoke", () => {
  test("login page renders the real email/password entry point", async ({ page }) => {
    const response = await page.goto("/logga-in");

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1, name: "Logga in till Proffera" })).toBeVisible();
    await expect(page.getByLabel("E-post")).toBeVisible();
    await expect(page.getByLabel("Lösenord")).toBeVisible();
    await expect(page.getByRole("button", { name: "Logga in" })).toBeVisible();
  });

  test("quote intake advances from service selection into adaptive details without submitting", async ({ page }) => {
    const response = await page.goto("/fa-offert");

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1, name: "Beskriv ditt uppdrag steg för steg." })).toBeVisible();
    await expect(page.getByText("Steg 1 av 6")).toBeVisible();

    await page.getByLabel("Kategori").selectOption({ index: 1 });
    await expect(page.getByLabel("Tjänstetyp")).toBeEnabled();
    await page.getByLabel("Tjänstetyp").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Fortsätt" }).click();

    await expect(page.getByText("Steg 2 av 6")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Berätta lite mer om jobbet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tillbaka" })).toBeEnabled();
  });
});
