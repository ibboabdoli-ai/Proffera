import { expect, test } from "@playwright/test";

test.describe("public nearby geolocation reliability", () => {
  test("retries after a transient geolocation timeout and keeps exact coordinates out of the URL", async ({ page }) => {
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
    await expect(page.getByRole("button", { name: "Nära mig" })).toBeEnabled();
    const url = new URL(page.url());
    expect(url.searchParams.get("service")).toBe("VVS & rörmokare");
    expect(url.searchParams.get("nearby")).toBe("1");
    expect(url.searchParams.get("radius")).toBe("25");
    expect(url.searchParams.has("latitude")).toBe(false);
    expect(url.searchParams.has("longitude")).toBe(false);
    expect(page.url()).not.toContain("59.329323");
    expect(page.url()).not.toContain("18.068581");

    const cookies = await page.context().cookies();
    const swedishNearbyCookie = cookies.find((cookie) => cookie.name === "proffera_public_directory_nearby_sv");
    const englishNearbyCookie = cookies.find((cookie) => cookie.name === "proffera_public_directory_nearby_en");
    expect(swedishNearbyCookie?.httpOnly).toBe(true);
    expect(swedishNearbyCookie?.path).toBe("/foretag/listad");
    expect(englishNearbyCookie?.httpOnly).toBe(true);
    expect(englishNearbyCookie?.path).toBe("/en/companies");

    await page.goto("/en/companies?service=plumber&nearby=1&radius=25");
    await expect(page.getByLabel("Location")).toHaveValue("My location");
    await expect(page.getByRole("button", { name: "Near me" })).toBeEnabled();
    expect(page.url()).not.toContain("latitude=");
    expect(page.url()).not.toContain("longitude=");
  });

  test("fails closed when nearby is requested without a current private position cookie", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/foretag/listad?service=elektriker&nearby=1&radius=25");

    await expect(page.getByText("Positionen kunde inte tolkas. Prova Nära mig igen eller sök med ort.")).toBeVisible();
    await expect(page.getByLabel("Ort")).toHaveValue("");
    const url = new URL(page.url());
    expect(url.searchParams.get("nearby")).toBe("1");
    expect(url.searchParams.has("latitude")).toBe(false);
    expect(url.searchParams.has("longitude")).toBe(false);
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

  test("does not turn the generated nearby label into a manual location after a failed retry", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition(success) {
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
    await page.getByLabel("Tjänst").fill("Elektriker");
    await page.getByRole("button", { name: "Nära mig" }).click();
    await expect(page).toHaveURL(/nearby=1/);
    await expect(page.getByLabel("Ort")).toHaveValue("Min plats");

    await page.route("**/*", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && request.headers()["next-action"]) {
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    await page.getByRole("button", { name: "Nära mig" }).click();

    await expect(page.getByRole("status")).toContainText(
      "Positionen hittades men sökningen kunde inte startas",
    );
    await expect(page.getByLabel("Ort")).toHaveValue("");
    await page.getByRole("button", { name: "Sök" }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("location")).toBeNull();
  });

  test("preserves a manual location edit made while a nearby action is in flight and then fails", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition(success) {
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

    let markActionSeen;
    const actionSeen = new Promise((resolve) => {
      markActionSeen = resolve;
    });
    let releaseAction;
    const actionGate = new Promise((resolve) => {
      releaseAction = resolve;
    });

    await page.route("**/*", async (route) => {
      const request = route.request();
      if (request.method() === "POST" && request.headers()["next-action"]) {
        markActionSeen();
        await actionGate;
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    await page.goto("/");
    const locationInput = page.getByLabel("Ort");
    await locationInput.fill("Stockholm");
    await page.getByRole("button", { name: "Nära mig" }).click();
    await actionSeen;
    await expect(locationInput).toHaveValue("Min plats");

    await locationInput.fill("Södertälje");
    releaseAction();

    await expect(page.getByRole("status")).toContainText(
      "Positionen hittades men sökningen kunde inte startas",
    );
    await expect(locationInput).toHaveValue("Södertälje");
  });
});
