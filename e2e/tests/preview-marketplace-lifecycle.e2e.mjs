import { expect, test } from "@playwright/test";

const lifecycle = {
  providerToken: process.env.E2E_MARKETPLACE_PROVIDER_TOKEN ?? "",
  customerToken: process.env.E2E_MARKETPLACE_CUSTOMER_TOKEN ?? "",
  reviewToken: process.env.E2E_MARKETPLACE_REVIEW_TOKEN ?? "",
};
const lifecycleReady = Object.values(lifecycle).every(Boolean);

const rematch = {
  customerToken: process.env.E2E_MARKETPLACE_REMATCH_CUSTOMER_TOKEN ?? "",
};
const rematchReady = Object.values(rematch).every(Boolean);

test.describe.serial("isolated Preview Marketplace lifecycle", () => {
  // These tests intentionally mutate one-shot synthetic fixtures. Retrying the
  // same fixture would test an already-consumed token rather than the lifecycle.
  test.describe.configure({ retries: 0 });

  test.skip(
    !lifecycleReady,
    "Requires dedicated synthetic Preview provider/customer/review tokens.",
  );

  test("selected winner can start and complete a job, then customer submits a verified review", async ({
    page,
    request,
  }) => {
    const providerResponse = await page.goto(`/offert/jobb/${encodeURIComponent(lifecycle.providerToken)}`);
    expect(providerResponse?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Hantera det valda jobbet" })).toBeVisible();
    await expect(page.getByText("accepted", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Starta jobbet" }).click();
    await page.waitForURL(/\bjob=in_progress\b/);
    await expect(page.getByRole("status")).toContainText("Jobbet har startats.");
    await expect(page.getByText("in_progress", { exact: true })).toBeVisible();

    await page.getByLabel("Kort sammanfattning av utfört arbete").fill("E2E-arbetet är slutfört och verifierat.");
    await page.getByRole("button", { name: "Markera slutfört" }).click();
    await page.waitForURL(/\bjob=completed\b/);
    await expect(page.getByRole("status")).toContainText("Jobbet har markerats som slutfört.");
    await expect(page.getByText("completed", { exact: true })).toBeVisible();

    const customerResponse = await page.goto(`/offert/jobb/kund/${encodeURIComponent(lifecycle.customerToken)}`);
    expect(customerResponse?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Följ jobbet" })).toBeVisible();
    await expect(page.getByText("Slutfört", { exact: true })).toBeVisible();
    await expect(page.getByText(/verifierat omdöme/i)).toBeVisible();

    const reviewPageResponse = await page.goto(`/review/marketplace/${encodeURIComponent(lifecycle.reviewToken)}`);
    expect(reviewPageResponse?.ok()).toBeTruthy();
    await expect(page.getByText(/omdöme|review/i).first()).toBeVisible();

    const reviewResponse = await request.post(`/api/reviews/${encodeURIComponent(lifecycle.reviewToken)}`, {
      data: {
        reviewerName: "E2E Kund",
        rating: 5,
        message: "Verifierad E2E-recension för Marketplace-livscykeln.",
        consent: true,
        website: "",
        formStartedAt: Date.now() - 10_000,
      },
    });
    expect(reviewResponse.status()).toBe(201);
    expect(await reviewResponse.json()).toEqual({ ok: true });

    await page.goto(`/review/marketplace/${encodeURIComponent(lifecycle.reviewToken)}`);
    await expect(page.getByText(/redan|already/i).first()).toBeVisible();
  });
});

test.describe.serial("isolated Preview Marketplace rematch", () => {
  test.describe.configure({ retries: 0 });

  test.skip(!rematchReady, "Requires a dedicated synthetic Preview customer token for a terminal/problem job.");

  test("customer requests a fresh matching generation without promoting an old offer", async ({ page }) => {
    const response = await page.goto(`/offert/jobb/kund/${encodeURIComponent(rematch.customerToken)}`);
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { name: "Följ jobbet" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Hitta ett nytt företag" })).toBeVisible();

    await page.getByLabel("Anledning").last().fill("E2E rematch efter problem med det valda jobbet.");
    await page.getByRole("button", { name: "Hitta ett nytt företag" }).click();
    await page.waitForURL(/\bstatus=requested\b/);
    await expect(page.getByRole("status")).toContainText("En ny matchning har beställts.");
    await expect(page.getByText(/väntar på behandling/i)).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: "Hitta ett nytt företag" })).toHaveCount(0);
    await expect(page.getByText(/väntar på behandling/i)).toBeVisible();
  });
});
