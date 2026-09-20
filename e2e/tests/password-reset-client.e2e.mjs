import { expect, test } from "@playwright/test";

const resetToken = "ABCDEFGHIJKLMNOPQRSTUVWX";
const newPassword = "Proffera-Test-Password-2026";

test.describe("password reset client behavior", () => {
  test("keeps reset-request feedback generic for different account emails", async ({ page }) => {
    const submittedEmails = [];

    await page.route("**/api/auth/request-password-reset", async (route) => {
      const payload = route.request().postDataJSON();
      submittedEmails.push(payload.email);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: true }),
      });
    });

    for (const email of ["existing@example.com", "unknown@example.com"]) {
      const response = await page.goto("/glomt-losenord?lang=en");
      expect(response?.ok()).toBeTruthy();
      await page.getByLabel("Email").fill(email);
      await page.getByRole("button", { name: "Send reset link" }).click();
      await expect(page.getByRole("status")).toContainText(
        "If an account exists for that email address, we will send a reset link.",
      );
    }

    expect(submittedEmails).toEqual(["existing@example.com", "unknown@example.com"]);
  });

  test("scrubs the fragment, preserves the token across language switching, and submits only password plus token", async ({ page }) => {
    let submittedPayload = null;
    let browserUrlAtSubmit = null;

    await page.route("**/api/auth/reset-password", async (route) => {
      submittedPayload = route.request().postDataJSON();
      browserUrlAtSubmit = page.url();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: true }),
      });
    });

    const response = await page.goto(`/aterstall-losenord?lang=en#token=${resetToken}`);
    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1, name: "Choose a new password" })).toBeVisible();
    await expect.poll(() => page.url()).not.toContain("#token=");

    await page.getByRole("button", { name: "SV" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Välj ett nytt lösenord" })).toBeVisible();
    await expect(page.getByLabel("Nytt lösenord", { exact: true })).toBeVisible();
    await expect.poll(() => page.url()).not.toContain("#token=");

    await page.getByLabel("Nytt lösenord", { exact: true }).fill(newPassword);
    await page.getByLabel("Bekräfta nytt lösenord", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Spara nytt lösenord" }).click();

    await expect.poll(() => submittedPayload).not.toBeNull();
    expect(submittedPayload).toEqual({
      newPassword,
      token: resetToken,
    });
    expect(browserUrlAtSubmit).not.toContain("#token=");
    await expect(page).toHaveURL(/\/logga-in\?reset=1$/);
  });
});
