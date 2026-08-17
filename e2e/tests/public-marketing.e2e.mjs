import { expect, test } from "@playwright/test";

test.describe("public marketplace smoke", () => {
  test("Swedish root renders the simplified marketplace home and routes a real search", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.ok()).toBeTruthy();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Vad behöver du hjälp med?",
      }),
    ).toBeVisible();
    await expect(page.getByText("Hitta företag, boka tid eller få offerter – gratis.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Populära tjänster" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Frisör & barberare/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Elektriker/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "För företag" }).first()).toBeVisible();
    await expect(page.locator("#proffera-chat-widget")).toHaveCount(0);

    await page.getByLabel("Tjänst").fill("Frisör");
    await page.getByLabel("Ort").fill("Södertälje");
    await page.getByRole("button", { name: "Sök" }).click();
    await expect(page).toHaveURL(/\/foretag\/listad\?/);
    await expect(page.getByRole("heading", { level: 1, name: "Hitta rätt företag för jobbet" })).toBeVisible();
    await expect(page.getByText("Ortssökning utgår från företagets registrerade ort. Bekräftat serviceområde visas separat.")).toBeVisible();

    const url = new URL(page.url());
    expect(url.pathname).toBe("/foretag/listad");
    expect(url.searchParams.get("service")).toBe("Frisör");
    expect(url.searchParams.get("location")).toBe("Södertälje");
  });

  test("English root renders the simplified marketplace home and normalizes Hairdresser", async ({ page }) => {
    const response = await page.goto("/en");

    expect(response?.ok()).toBeTruthy();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "What do you need help with?",
      }),
    ).toBeVisible();
    await expect(page.getByText("Find businesses, book an appointment or request quotes – free.")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Popular services" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Hairdresser & barber/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "For businesses" }).first()).toBeVisible();
    await expect(page.locator("#proffera-chat-widget")).toHaveCount(0);

    await page.getByLabel("Service").fill("Hairdresser");
    await page.getByLabel("Location").fill("Södertälje");
    await page.getByRole("button", { name: "Search" }).click();
    await expect(page).toHaveURL(/\/en\/companies\?/);
    await expect(page.getByRole("heading", { level: 1, name: "Find the right company for the job" })).toBeVisible();
    await expect(page.getByText("Location search uses the business's registered location. Confirmed service area is shown separately.")).toBeVisible();

    const url = new URL(page.url());
    expect(url.pathname).toBe("/en/companies");
    expect(url.searchParams.get("service")).toBe("frisor");
    expect(url.searchParams.get("location")).toBe("Södertälje");
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
