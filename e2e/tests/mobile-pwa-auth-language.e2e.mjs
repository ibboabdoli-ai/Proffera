import { expect, test } from "@playwright/test";

const activationHarnessPath = "/aktivera/__mobile-i18n-activation-e2e__";
const dashboardHarnessPath = "/aktivera/__mobile-i18n-dashboard-e2e__";

function queryValue(page, key) {
  return new URL(page.url()).searchParams.get(key);
}

test.describe("mobile PWA and auth language browser wiring", () => {
  test.skip(process.env.CI !== "true", "The local harness is intentionally available only in CI development mode.");

  test("switches activation language without losing in-progress password values", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const response = await page.goto(`${activationHarnessPath}?lang=sv&plan=pro&campaign=launch&error=expired`);

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { level: 2, name: "Välj ditt lösenord" })).toBeVisible();

    const password = page.getByLabel("Välj lösenord");
    const confirmation = page.getByLabel("Upprepa lösenord");
    await password.fill("BrowserPass-123");
    await confirmation.fill("BrowserPass-123");

    await page.getByRole("button", { name: "EN", exact: true }).click();

    await expect.poll(() => queryValue(page, "lang")).toBe("en");
    expect(queryValue(page, "plan")).toBe("pro");
    expect(queryValue(page, "campaign")).toBe("launch");
    expect(queryValue(page, "error")).toBeNull();
    await expect(page.getByRole("heading", { level: 2, name: "Choose your password" })).toBeVisible();
    await expect(page.getByLabel("Choose password")).toHaveValue("BrowserPass-123");
    await expect(page.getByLabel("Repeat password")).toHaveValue("BrowserPass-123");

    const redirectQuery = await page.locator('input[name="redirect_query"]').inputValue();
    const redirectParams = new URLSearchParams(redirectQuery);
    expect(redirectParams.get("lang")).toBe("en");
    expect(redirectParams.get("plan")).toBe("pro");
    expect(redirectParams.get("campaign")).toBe("launch");
    expect(redirectParams.has("error")).toBe(false);
  });

  test("keeps the mobile dashboard drawer modal and preserves query context on language switch", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(`${dashboardHarnessPath}?lang=en&campaign=spring&filter=open`);

    expect(response?.ok()).toBeTruthy();
    const trigger = page.getByRole("button", { name: "Open menu" });
    await expect(trigger.locator("xpath=ancestor::header")).toHaveAttribute("style", /safe-area-inset-top/);
    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Dashboard menu" });
    await expect(dialog).toBeVisible();
    const panel = dialog.locator("aside");
    await expect(panel).toHaveAttribute("style", /safe-area-inset-top/);

    const closeButton = panel.getByRole("button", { name: "Close menu" });
    await expect(closeButton).toBeFocused();

    const focusable = panel.locator('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])');
    expect(await focusable.count()).toBeGreaterThan(1);
    const first = focusable.first();
    const last = focusable.last();

    await last.focus();
    await page.keyboard.press("Tab");
    await expect(first).toBeFocused();

    await first.focus();
    await page.keyboard.press("Shift+Tab");
    await expect(last).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    const languageLink = page.getByRole("dialog", { name: "Dashboard menu" }).getByRole("link", { name: "Svenska" });
    await languageLink.click();

    await expect.poll(() => new URL(page.url()).pathname).toBe(dashboardHarnessPath);
    await expect.poll(() => queryValue(page, "lang")).toBeNull();
    expect(queryValue(page, "campaign")).toBe("spring");
    expect(queryValue(page, "filter")).toBe("open");
  });
});
