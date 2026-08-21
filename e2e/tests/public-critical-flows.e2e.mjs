import { expect, test } from "@playwright/test";

const quoteLanguageDraftKey = "proffera:quote-request:language-draft:v1";

async function seedQuoteLanguageDraft(page, data) {
  await page.evaluate(({ key, data: draftData }) => {
    window.sessionStorage.setItem(key, JSON.stringify({
      savedAt: Date.now(),
      data: draftData,
      smartAnswers: {},
      step: 2,
    }));
  }, { key: quoteLanguageDraftKey, data });
}

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

  test("restores private location and current step from Swedish into English", async ({ page }) => {
    await page.goto("/fa-offert");
    await seedQuoteLanguageDraft(page, {
      addressLine1: "Storgatan 12",
      locationSource: "address",
      latitude: null,
      longitude: null,
      city: "Södertälje",
      postalCode: "151 46",
    });

    const response = await page.goto("/en/get-quote?resume=1");

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByText("Step 3 of 6")).toBeVisible();
    await expect(page.getByLabel("Street address")).toHaveValue("Storgatan 12");
    await expect(page.getByLabel("City")).toHaveValue("Södertälje");
    await expect(page.getByLabel("Postal code")).toHaveValue("151 46");
    await expect.poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), quoteLanguageDraftKey)).toBeNull();
  });

  test("restores private location and current step from English into Swedish", async ({ page }) => {
    await page.goto("/en/get-quote");
    await seedQuoteLanguageDraft(page, {
      addressLine1: "Järnagatan 8",
      locationSource: "address",
      latitude: null,
      longitude: null,
      city: "Södertälje",
      postalCode: "151 73",
    });

    const response = await page.goto("/fa-offert?resume=1");

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByText("Steg 3 av 6")).toBeVisible();
    await expect(page.getByLabel("Gatuadress")).toHaveValue("Järnagatan 8");
    await expect(page.getByLabel("Stad")).toHaveValue("Södertälje");
    await expect(page.getByLabel("Postnummer")).toHaveValue("151 73");
    await expect.poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), quoteLanguageDraftKey)).toBeNull();
  });
});
