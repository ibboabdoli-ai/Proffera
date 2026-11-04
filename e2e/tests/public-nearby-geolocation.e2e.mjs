import { expect, test } from "@playwright/test";

test.describe("on-demand private location search", () => {
  test("retries transient geolocation error, searches 10 km by default and protects coordinates", async ({ page }) => {
    await page.addInitScript(() => {
      let attempts = 0;
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition(success, error) {
            attempts += 1;
            if (attempts === 1) {
              error({ code: 3, PERMISSION_DENIED: 1 });
              return;
            }
            success({ coords: { latitude: 59.329323, longitude: 18.068581 } });
          },
        },
      });
    });
    await page.goto("/");
    await page.getByLabel("Tjänst").fill("VVS & rörmokare");
    await page.getByRole("button", { name: "Nära mig" }).click();
    await expect(page).toHaveURL(/\/foretag\/listad\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get("service")).toBe("VVS & rörmokare");
    expect(url.searchParams.get("nearby")).toBe("1");
    expect(url.searchParams.get("radius")).toBe("10");
    expect(url.searchParams.has("latitude")).toBe(false);
    expect(url.searchParams.has("longitude")).toBe(false);
    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "proffera_public_directory_nearby_sv")?.httpOnly).toBe(true);
    expect(cookies.find((c) => c.name === "proffera_public_directory_nearby_en")?.httpOnly).toBe(true);

    await page.goto("/en/companies?service=plumber&nearby=1&radius=10");
    await expect(page.getByLabel("Your address")).toBeEmpty();
    await expect(page.getByRole("button", { name: "Near me" })).toBeEnabled();
  });

  test("does not query all of Sweden when the short-lived location cookie is missing", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/foretag/listad?service=elektriker&nearby=1&radius=50");
    await expect(page.getByText(/Positionen saknas eller har gått ut/)).toBeVisible();
    await expect(page.getByLabel("Din adress")).toBeEmpty();
    await expect(page.getByText("Företag som matchar")).toHaveCount(0);
  });

  test("shows service and address validation without doing a broad search", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Nära mig" }).click();
    await expect(page.getByRole("status")).toContainText("Välj vilken tjänst");
    await page.getByLabel("Tjänst").fill("Elektriker");
    await page.getByRole("button", { name: "Sök", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Ange en adress");
    expect(new URL(page.url()).pathname).toBe("/");
  });

  test("preserves typed address if device permission is denied", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition(_success, error) { error({ code: 1, PERMISSION_DENIED: 1 }); },
        },
      });
    });
    await page.goto("/");
    await page.getByLabel("Tjänst").fill("Elektriker");
    await page.getByLabel("Din adress").fill("Storgatan 5, 151 72 Södertälje");
    await page.getByRole("button", { name: "Nära mig" }).click();
    await expect(page.getByRole("status")).toContainText("Platsåtkomst är blockerad");
    await expect(page.getByLabel("Din adress")).toHaveValue("Storgatan 5, 151 72 Södertälje");
    expect(new URL(page.url()).pathname).toBe("/");
  });
});
