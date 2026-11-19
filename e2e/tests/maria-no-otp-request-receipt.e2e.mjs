import { test, expect } from "@playwright/test";

test("Maria no-OTP request is submitted once and receipt follows language changes", async ({ page }) => {
  // This is a browser-only test with intercepted APIs: no real bookings,
  // customers, SMS, emails or Production requests are created.
  const friday = new Date(Date.now() + 14 * 86_400_000);
  while (friday.getUTCDay() !== 5) friday.setUTCDate(friday.getUTCDate() + 1);
  const date = friday.toISOString().slice(0, 10);
  const year = Number(date.slice(0, 4));
  let submitted = 0;
  let sentBody;

  await page.route("**/api/makeup-by-maria/config", async (route) => {
    await route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        connected: true, bookingEnabled: true, otpRequired: false,
        years: [{ year, enabled: true, trial: 6900, without: null }],
        bookableDurations: { [String(year)]: { trial: 180 } },
        bookableAdvanceDays: { [String(year)]: { trial: 365 } },
        hours: [{ weekday: 5, opensAt: "06:00", closesAt: "10:00" }],
      }),
    });
  });
  await page.route("**/api/makeup-by-maria/availability?*", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, times: ["07:00"] }) });
  });
  await page.route("**/api/makeup-by-maria/booking", async (route) => {
    submitted += 1;
    sentBody = route.request().postDataJSON();
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ok: true, requestReceived: true }) });
  });

  await page.goto("/demo/makeup-by-maria-v2.html", { waitUntil: "domcontentloaded" });
  await page.locator(`.year-options button[data-year="${year}"]`).click();
  await page.locator('[data-package="trial"]').click();
  await expect(page.locator('[data-i="submit"]')).toContainText("SKICKA BOKNINGSFÖRFRÅGAN");
  await page.locator("#weddingDate").selectOption(date);
  await expect(page.locator('#weddingTime option[value="07:00"]')).toHaveCount(1);
  await page.locator("#weddingTime").selectOption("07:00");
  await page.locator("#customerName").fill("Synthetic QA Bride");
  await page.locator("#customerEmail").fill("bride@example.com");
  await page.locator("#customerPhone").fill("0701234567");

  await page.locator('#bookingForm button[type="submit"]').click();
  await expect(page.locator("#bookingComplete")).toBeVisible();
  await expect(page.locator("#bookingCompleteTitle")).toHaveText("Förfrågan skickad");
  await expect(page.locator('#bookingForm button[type="submit"]')).toBeDisabled();
  expect(submitted).toBe(1);
  expect(sentBody).toMatchObject({ kind: "trial", year, date, time: "07:00", email: "bride@example.com" });
  expect(page.url()).toContain("/demo/makeup-by-maria-v2.html");
  expect(page.url()).not.toContain("/boka/verifiera/");

  await page.locator('[data-lang="en"]').click();
  await expect(page.locator("#bookingComplete")).toBeVisible();
  await expect(page.locator("#bookingCompleteTitle")).toHaveText("Request received");
  await expect(page.locator("#bookingCompleteAgain")).toHaveAttribute("href", "/demo/makeup-by-maria-v2.html?lang=en");
  await expect(page.locator('#bookingForm button[type="submit"]')).toBeDisabled();

  await page.locator('[data-lang="ar"]').click();
  await expect(page.locator("#bookingComplete")).toBeVisible();
  await expect(page.locator("#bookingCompleteTitle")).toHaveText("تم إرسال الطلب");
  await expect(page.locator('#bookingForm button[type="submit"]')).toBeDisabled();
  expect(submitted).toBe(1);
  expect(page.url()).not.toContain("/boka/verifiera/");
});
