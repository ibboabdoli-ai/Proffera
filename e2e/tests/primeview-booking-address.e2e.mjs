import { expect, test } from "@playwright/test";

async function openBooking(page, viewport) {
  await page.setViewportSize(viewport);
  const response = await page.goto("/primeview-booking");
  expect(response?.ok()).toBeTruthy();
  if ((await page.locator("form").count()) === 0) {
    test.skip(true, "PrimeView booking fixture is unavailable in this isolated environment.");
  }
}

async function requestNativeSubmit(page) {
  await page.locator("form").evaluate((form) => form.requestSubmit());
}

async function completeNativeRequirements(page) {
  await page.getByLabel("Property type").selectOption({ label: "Flat / Apartment" });

  const requiredNumbers = page.locator('input[type="number"][required]:visible');
  for (let index = 0; index < await requiredNumbers.count(); index += 1) {
    await requiredNumbers.nth(index).fill("10");
  }

  const time = page.getByLabel("Time");
  const availableTime = await time.locator('option:not([value=""])').first().getAttribute("value");
  if (!availableTime) {
    test.skip(true, "PrimeView booking fixture has no available appointment time.");
  }
  await time.selectOption(availableTime);
  await page.getByLabel("Name").fill("Address Validation Check");
  await page.getByLabel("Phone").fill("07123456789");
  await page.getByLabel("Email").fill("address-validation@example.test");

  await expect(page.locator("form")).toHaveJSProperty("noValidate", false);
  expect(await page.locator("form").evaluate((form) => form.checkValidity())).toBe(true);
}

async function expectFirstAddressError(page, field, message) {
  const input = page.locator(`[data-address-field="${field}"]`);
  await expect(page.getByText(message)).toBeVisible();
  await expect(input).toBeFocused();
  await expect(input).toBeInViewport();
}

async function exerciseAddressValidation(page) {
  await completeNativeRequirements(page);

  await requestNativeSubmit(page);
  await expectFirstAddressError(page, "postcode", "Enter your UK postcode.");

  await page.locator('[data-address-field="postcode"]').fill("W4 3ES");
  await requestNativeSubmit(page);
  await expectFirstAddressError(page, "houseBuilding", "Enter the house number or building name.");

  await page.locator('[data-address-field="houseBuilding"]').fill("10");
  await requestNativeSubmit(page);
  await expectFirstAddressError(page, "street", "Enter the street address.");

  await page.locator('[data-address-field="street"]').fill("High Street");
  await requestNativeSubmit(page);
  await expectFirstAddressError(page, "unit", "Enter the flat, apartment or unit number.");

  for (const repeatedLabel of ["Flat Flat", "Apartment Apartment", "Unit Unit", "Flat Apartment Unit"]) {
    await page.locator('[data-address-field="unit"]').fill(repeatedLabel);
    await requestNativeSubmit(page);
    await expectFirstAddressError(page, "unit", "Enter the flat, apartment or unit number.");
  }

  for (const [unit, address] of [
    ["Flat 2B", "Flat 2B, 10, High Street"],
    ["Apartment 4", "Flat 4, 10, High Street"],
    ["Unit 7", "Flat 7, 10, High Street"],
  ]) {
    await page.locator('[data-address-field="unit"]').fill(unit);
    await expect(page.locator('input[name="address"]')).toHaveValue(address);
    await expect(page.getByText("Enter the flat, apartment or unit number.")).toHaveCount(0);
  }
}

test("PrimeView complete-address validation works on desktop without submitting a booking", async ({ page }) => {
  await openBooking(page, { width: 1280, height: 900 });
  await exerciseAddressValidation(page);
});

test("PrimeView complete-address validation works on mobile without submitting a booking", async ({ page }) => {
  await openBooking(page, { width: 390, height: 844 });
  await exerciseAddressValidation(page);
});
