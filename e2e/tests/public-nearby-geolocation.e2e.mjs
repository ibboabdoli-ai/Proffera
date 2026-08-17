import { expect, test } from "@playwright/test";

test.describe("public nearby geolocation reliability", () => {
  test("retries after a transient geolocation timeout and continues nearby search", async ({ page }) => {
    await page.addInitScript(() => {
      let attempts = 0;
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition(success, error) {
            attempts += 1;
            if (attempts === 1) {
              error({
                code: 3,
                message: "Timed out",
                PERMISSION_DENIED: 1,
                POSITION_UNAVAILABLE: 2,
                TIMEOUT: 3,
              });
              return;
            }

            success({
              coords: {
                latitude: 59.329323,
                longitude: 18.068581,
                accuracy: 100,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
              },
              timestamp: Date.now(),
            });
          },
        },
      });
    });

    await page.goto("/");
    await page.getByLabel("Tjänst").fill("VVS & rörmokare");
    await page.getByRole("button", { name: "Nära mig" }).click();

    await expect(page).toHaveURL(/\/foretag\/listad\?/);
    const url = new URL(page.url());
    expect(url.searchParams.get("latitude")).toBe("59.329323");
    expect(url.searchParams.get("longitude")).toBe("18.068581");
    expect(url.searchParams.get("radius")).toBe("25");
  });

  test("shows a permission-specific message instead of blaming every geolocation failure on permissions", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition(_success, error) {
            error({
              code: 1,
              message: "Permission denied",
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            });
          },
        },
      });
    });

    await page.goto("/");
    await page.getByRole("button", { name: "Nära mig" }).click();

    await expect(page.getByRole("status")).toContainText(
      "Platsåtkomst är blockerad. Tillåt plats för proffera.se",
    );
    expect(new URL(page.url()).pathname).toBe("/");
  });
});
