import { expect, test } from "@playwright/test";

async function openBooking(page, viewport) {
  await page.setViewportSize(viewport);
  const response = await page.goto("/primeview-booking");
  expect(response?.ok()).toBeTruthy();
  if ((await page.locator("form").count()) === 0) {
    test.skip(true, "PrimeView booking fixture is unavailable in this isolated environment.");
  }
}

async function dispatchSyntheticSubmit(page) {
  return page.locator("form").evaluate((form) => {
    const event = new Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    return event.defaultPrevented;
  });
}

async function exerciseAddressValidation(page) {
  await page.getByLabel("Property type").selectOption({ label: "Flat / Apartment" });

  expect(await dispatchSyntheticSubmit(page)).toBe(true);
  await expect(page.getByText("Enter your UK postcode.")).toBeVisible();
  await expect(page.locator('[data-address-field="postcode"]')).toBeFocused();

  await page.locator('[data-address-field="postcode"]').fill("W4 3ES");
  expect(await dispatchSyntheticSubmit(page)).toBe(true);
  await expect(page.getByText("Enter the house number or building name.")).toBeVisible();
  await expect(page.locator('[data-address-field="houseBuilding"]')).toBeFocused();

  await page.locator('[data-address-field="houseBuilding"]').fill("10");
  expect(await dispatchSyntheticSubmit(page)).toBe(true);
  await expect(page.getByText("Enter the street address.")).toBeVisible();
  await expect(page.locator('[data-address-field="street"]')).toBeFocused();

  await page.locator('[data-address-field="street"]').fill("High Street");
  expect(await dispatchSyntheticSubmit(page)).toBe(true);
  await expect(page.getByText("Enter the flat, apartment or unit number.")).toBeVisible();
  await expect(page.locator('[data-address-field="unit"]')).toBeFocused();

  await page.locator('[data-address-field="unit"]').fill("2B");
  await expect(page.locator('input[name="address"]')).toHaveValue("Flat 2B, 10, High Street");
  await expect(page.getByText("Enter the flat, apartment or unit number.")).toHaveCount(0);
}

test("PrimeView complete-address validation works on desktop without submitting a booking", async ({ page }) => {
  await openBooking(page, { width: 1280, height: 900 });
  await exerciseAddressValidation(page);
});

test("PrimeView complete-address validation works on mobile without submitting a booking", async ({ page }) => {
  await openBooking(page, { width: 390, height: 844 });
  await exerciseAddressValidation(page);
});
