import { expect, test } from "@playwright/test";

const authConfig = {
  userAEmail: process.env.E2E_USER_A_EMAIL ?? "",
  userAPassword: process.env.E2E_USER_A_PASSWORD ?? "",
  userAWorkspace: process.env.E2E_USER_A_WORKSPACE_NAME ?? "",
  userBEmail: process.env.E2E_USER_B_EMAIL ?? "",
  userBPassword: process.env.E2E_USER_B_PASSWORD ?? "",
  userBWorkspace: process.env.E2E_USER_B_WORKSPACE_NAME ?? "",
};

const authReady = Object.values(authConfig).every(Boolean);
const bookingSlug = process.env.E2E_BOOKING_SLUG ?? "";

async function signIn(page, email, password) {
  await page.goto("/logga-in");
  await page.getByLabel("E-post").fill(email);
  await page.getByLabel("Lösenord").fill(password);
  await page.getByRole("button", { name: "Logga in" }).click();
  await page.waitForURL(/\/dashboard(?:\/|$|\?)/, { timeout: 30_000 });
}

test.describe("isolated Preview authenticated smoke", () => {
  test.skip(!authReady, "Requires two dedicated isolated Preview test accounts and workspace names.");

  test("user A sees its workspace and not user B workspace", async ({ page }) => {
    await signIn(page, authConfig.userAEmail, authConfig.userAPassword);

    await expect(page.getByText(authConfig.userAWorkspace, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(authConfig.userBWorkspace, { exact: true })).toHaveCount(0);
    await expect(page.getByText("Åtkomst saknas")).toHaveCount(0);
  });

  test("user B sees its workspace and not user A workspace", async ({ page }) => {
    await signIn(page, authConfig.userBEmail, authConfig.userBPassword);

    await expect(page.getByText(authConfig.userBWorkspace, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(authConfig.userAWorkspace, { exact: true })).toHaveCount(0);
    await expect(page.getByText("Åtkomst saknas")).toHaveCount(0);
  });
});

test.describe("isolated Preview booking smoke", () => {
  test.skip(!bookingSlug, "Requires E2E_BOOKING_SLUG for a dedicated isolated Preview booking workspace.");

  test("published test booking page renders without creating a booking", async ({ page }) => {
    const response = await page.goto(`/boka/${encodeURIComponent(bookingSlug)}`);

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByText("Boka online")).toBeVisible();
    await expect(page.getByText("Vi skickar en sexsiffrig kod till din e-post. Bokningen skapas först efter verifiering.")).toBeVisible();
    await expect(page.getByText("Bokning är inte tillgänglig ännu")).toHaveCount(0);
  });
});
