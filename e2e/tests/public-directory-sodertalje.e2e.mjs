import { expect, test } from "@playwright/test";

test.describe("Södertälje public Directory geospatial discovery", () => {
  test("legacy city-only links cannot silently return companies from across Sweden", async ({ page }) => {
    const response = await page.goto("/foretag/listad?service=Elektriker&location=S%C3%B6dert%C3%A4lje");
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1, name: "Hitta rätt företag för jobbet" })).toBeVisible();
    await expect(page.getByLabel("Tjänst")).toHaveValue("Elektriker");
    await expect(page.getByLabel("Din adress")).toBeEmpty();
    await expect(page.getByText("Företag som matchar")).toHaveCount(0);
    await expect(page.getByText("Tjänsten känns inte igen ännu.", { exact: false })).toHaveCount(0);
  });

  test("a private Södertälje origin survives paginated result URLs", async ({ page, context }) => {
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 59.1955, longitude: 17.6253 });
    await page.goto("/");
    await page.getByLabel("Tjänst").fill("Elektriker");
    await page.getByRole("button", { name: "Nära mig" }).click();
    await expect(page).toHaveURL(/\/foretag\/listad\?/);
    let url = new URL(page.url());
    expect(url.searchParams.get("radius")).toBe("10");
    expect(url.searchParams.get("nearby")).toBe("1");
    expect(url.searchParams.has("latitude")).toBe(false);
    expect(url.searchParams.has("longitude")).toBe(false);

    await page.goto("/foretag/listad?service=Elektriker&nearby=1&radius=10&page=2");
    await expect(page.getByLabel("Tjänst")).toHaveValue("Elektriker");
    await expect(page.getByText("Positionen saknas eller har gått ut.")).toHaveCount(0);
    url = new URL(page.url());
    expect(url.searchParams.get("nearby")).toBe("1");
    expect(url.searchParams.get("page")).toBe("2");
  });
});
