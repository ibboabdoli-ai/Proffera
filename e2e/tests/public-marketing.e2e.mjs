import { expect, test } from "@playwright/test";

test.describe("public marketplace smoke", () => {
  test("Swedish root offers service plus private-location discovery without a city lookup", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 59.329323, longitude: 18.068581 });
    const response = await page.goto("/");
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1, name: "Vad behöver du hjälp med?" })).toBeVisible();
    await expect(page.getByText("Hitta företag, boka tid eller få offerter – gratis.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Populära tjänster" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Elektriker/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "För företag" }).first()).toBeVisible();
    await expect(page.getByLabel("Din adress")).toBeVisible();
    await expect(page.getByLabel("Sökradie")).toHaveValue("10");

    await page.getByLabel("Tjänst").fill("VVS & rörmokare");
    await page.getByRole("button", { name: "Nära mig" }).click();
    await expect(page).toHaveURL(/\/foretag\/listad\?/);
    await expect(page.getByRole("heading", { level: 1, name: "Hitta rätt företag för jobbet" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Byt till engelska" })).toBeVisible();
    await expect(page.getByText("Företag som matchar")).toBeVisible();

    const url = new URL(page.url());
    expect(url.searchParams.get("service")).toBe("VVS & rörmokare");
    expect(url.searchParams.get("nearby")).toBe("1");
    expect(url.searchParams.get("radius")).toBe("10");
    expect(url.searchParams.has("location")).toBe(false);
    expect(url.searchParams.has("latitude")).toBe(false);
    expect(url.searchParams.has("longitude")).toBe(false);

    const profileResponse = await page.goto("/foretag/listad/e2e-standalone-profile-that-does-not-exist");
    expect(profileResponse?.status()).toBe(404);
  });

  test("service-only links and malformed addresses do not start a country-wide query", async ({ page }) => {
    await page.goto("/foretag/listad?service=Elektriker");
    await expect(page.getByLabel("Tjänst")).toHaveValue("Elektriker");
    await expect(page.getByText("Företag som matchar")).toHaveCount(0);
    await page.getByLabel("Din adress").fill("STOCKHOLM");
    await page.getByRole("button", { name: "Sök", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Ange en fullständig adress");
    const url = new URL(page.url());
    expect(url.searchParams.has("location")).toBe(false);
    expect(url.searchParams.has("nearby")).toBe(false);
  });

  test("English root supports localized service search with the same private coordinate boundary", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 59.329323, longitude: 18.068581 });
    const response = await page.goto("/en");
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1, name: "What do you need help with?" })).toBeVisible();
    await expect(page.getByText("Find businesses, book an appointment or request quotes – free.")).toBeVisible();
    await expect(page.getByLabel("Your address")).toBeVisible();
    await page.getByLabel("Service").fill("Hairdresser");
    await page.getByRole("button", { name: "Near me" }).click();
    await expect(page).toHaveURL(/\/en\/companies\?/);
    await expect(page.getByRole("heading", { level: 1, name: "Find the right company for the job" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Switch to Swedish" })).toBeVisible();
    const url = new URL(page.url());
    expect(url.searchParams.get("service")).toBe("frisor");
    expect(url.searchParams.get("radius")).toBe("10");
    expect(url.searchParams.get("nearby")).toBe("1");
    expect(url.searchParams.has("location")).toBe(false);
  });

  test("Swedish business route renders the marketplace-aware workspace proposition", async ({ page }) => {
    const response = await page.goto("/for-foretag");
    expect(response?.ok()).toBeTruthy();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Få kunder från marknadsplatsen. Hantera resten i din arbetsyta.",
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Starta gratis i 14 dagar" }).first()).toBeVisible();
  });

  test("English business route renders the matching workspace proposition", async ({ page }) => {
    const response = await page.goto("/en/for-business");
    expect(response?.ok()).toBeTruthy();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Win customers from the marketplace. Manage the rest in your workspace.",
      }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Start free 14-day trial" }).first()).toBeVisible();
  });
});
