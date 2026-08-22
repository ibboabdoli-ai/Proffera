import { expect, test } from "@playwright/test";

const quoteLanguageDraftKey = "proffera:quote-request:language-draft:v1";

async function fillRequiredSmartDetails(page) {
  const groups = page.locator("fieldset");
  const count = await groups.count();
  const snapshot = [];

  for (let index = 0; index < count; index += 1) {
    const group = groups.nth(index);
    const radios = group.getByRole("radio");
    if (await radios.count()) {
      const radio = radios.first();
      await radio.check();
      snapshot.push({ type: "radio", value: await radio.getAttribute("value") });
      continue;
    }

    const input = group.locator("input").first();
    const type = await input.getAttribute("type");
    const value = type === "number" ? "1" : "Test details";
    await input.fill(value);
    snapshot.push({ type: "input", value });
  }

  return snapshot;
}

async function expectSmartDetails(page, snapshot) {
  const groups = page.locator("fieldset");
  await expect(groups).toHaveCount(snapshot.length);

  for (let index = 0; index < snapshot.length; index += 1) {
    const item = snapshot[index];
    const group = groups.nth(index);
    if (item.type === "radio") {
      await expect(group.getByRole("radio", { checked: true })).toHaveValue(item.value ?? "");
    } else {
      await expect(group.locator("input").first()).toHaveValue(item.value ?? "");
    }
  }
}

async function advanceQuoteToLocation(page, { path, nextLabel, step2Text, step3Text }) {
  const response = await page.goto(path);
  expect(response?.ok()).toBeTruthy();

  await page.locator("#category").selectOption({ index: 1 });
  await expect(page.locator("#serviceType")).toBeEnabled();
  await page.locator("#serviceType").selectOption({ index: 1 });
  await page.getByRole("button", { name: nextLabel }).click();

  await expect(page.getByText(step2Text)).toBeVisible();
  const smartDetails = await fillRequiredSmartDetails(page);
  await page.getByRole("button", { name: nextLabel }).click();
  await expect(page.getByText(step3Text)).toBeVisible();
  return smartDetails;
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

  test("preserves private location and smart answers when switching Swedish into English", async ({ page }) => {
    const smartDetails = await advanceQuoteToLocation(page, {
      path: "/fa-offert",
      nextLabel: "Fortsätt",
      step2Text: "Steg 2 av 6",
      step3Text: "Steg 3 av 6",
    });

    await page.getByLabel("Gatuadress").fill("Storgatan 12");
    await page.getByLabel("Stad").fill("Södertälje");
    await page.getByLabel("Postnummer").fill("151 46");

    await Promise.all([
      page.waitForURL(/\/en\/get-quote\?resume=1$/),
      page.getByRole("button", { name: "EN English" }).click(),
    ]);

    await expect(page.getByText("Step 3 of 6")).toBeVisible();
    await expect(page.getByLabel("Street address")).toHaveValue("Storgatan 12");
    await expect(page.getByLabel("City")).toHaveValue("Södertälje");
    await expect(page.getByLabel("Postal code")).toHaveValue("151 46");
    await expect.poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), quoteLanguageDraftKey)).toBeNull();

    await page.getByRole("button", { name: "Back" }).click();
    await expect(page.getByText("Step 2 of 6")).toBeVisible();
    await expectSmartDetails(page, smartDetails);
  });

  test("preserves private location and smart answers when switching English into Swedish", async ({ page }) => {
    const smartDetails = await advanceQuoteToLocation(page, {
      path: "/en/get-quote",
      nextLabel: "Continue",
      step2Text: "Step 2 of 6",
      step3Text: "Step 3 of 6",
    });

    await page.getByLabel("Street address").fill("Järnagatan 8");
    await page.getByLabel("City").fill("Södertälje");
    await page.getByLabel("Postal code").fill("151 73");

    await Promise.all([
      page.waitForURL(/\/fa-offert\?resume=1$/),
      page.getByRole("button", { name: "SV Svenska" }).click(),
    ]);

    await expect(page.getByText("Steg 3 av 6")).toBeVisible();
    await expect(page.getByLabel("Gatuadress")).toHaveValue("Järnagatan 8");
    await expect(page.getByLabel("Stad")).toHaveValue("Södertälje");
    await expect(page.getByLabel("Postnummer")).toHaveValue("151 73");
    await expect.poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), quoteLanguageDraftKey)).toBeNull();

    await page.getByRole("button", { name: "Tillbaka" }).click();
    await expect(page.getByText("Steg 2 av 6")).toBeVisible();
    await expectSmartDetails(page, smartDetails);
  });

  test("keeps an edited address when an older nearby-location callback resolves", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition(success) {
            window.setTimeout(() => {
              success({ coords: { latitude: 59.19554, longitude: 17.62525 } });
              document.documentElement.dataset.nearbyLocationCallback = "resolved";
            }, 200);
          },
        },
      });
    });

    await advanceQuoteToLocation(page, {
      path: "/fa-offert",
      nextLabel: "Fortsätt",
      step2Text: "Steg 2 av 6",
      step3Text: "Steg 3 av 6",
    });

    await page.getByRole("button", { name: "Nära mig" }).click();
    await page.getByLabel("Gatuadress").fill("Storgatan 77");
    await expect.poll(() => page.evaluate(
      () => document.documentElement.dataset.nearbyLocationCallback,
    )).toBe("resolved");
    await expect(page.getByLabel("Gatuadress")).toHaveValue("Storgatan 77");
  });

  test("discards a future-dated language draft instead of restoring it", async ({ page }) => {
    await page.addInitScript(({ key }) => {
      window.sessionStorage.setItem(key, JSON.stringify({
        savedAt: Date.now() + 60_000,
        data: { addressLine1: "Should not restore", city: "Stockholm", postalCode: "111 22" },
        smartAnswers: {},
        step: 2,
      }));
    }, { key: quoteLanguageDraftKey });

    const response = await page.goto("/en/get-quote?resume=1");
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByText("Step 1 of 6")).toBeVisible();
    await expect.poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), quoteLanguageDraftKey)).toBeNull();
  });
});
