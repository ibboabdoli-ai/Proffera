import { expect, test } from "@playwright/test";

test.describe("Södertälje public directory", () => {
  test("Elektriker + Södertälje stays stable across paginated result URLs", async ({ page }) => {
    const response = await page.goto("/foretag/listad?service=Elektriker&location=S%C3%B6dert%C3%A4lje");

    expect(response?.ok()).toBeTruthy();
    await expect(page.getByRole("heading", { level: 1, name: "Hitta rätt företag för jobbet" })).toBeVisible();
    await expect(page.getByLabel("Tjänst")).toHaveValue("Elektriker");
    await expect(page.getByLabel("Ort")).toHaveValue("Södertälje");
    await expect(page.getByText("Företag som matchar")).toBeVisible();
    await expect(page.getByText("Tjänsten känns inte igen ännu.", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Positionen kunde inte tolkas.", { exact: false })).toHaveCount(0);

    let url = new URL(page.url());
    expect(url.pathname).toBe("/foretag/listad");
    expect(url.searchParams.get("service")).toBe("Elektriker");
    expect(url.searchParams.get("location")).toBe("Södertälje");

    const pageTwoResponse = await page.goto("/foretag/listad?service=Elektriker&location=S%C3%B6dert%C3%A4lje&page=2");
    expect(pageTwoResponse?.ok()).toBeTruthy();
    await expect(page).toHaveURL(/\/foretag\/listad\?.*page=2/);
    await expect(page.getByRole("heading", { level: 1, name: "Hitta rätt företag för jobbet" })).toBeVisible();
    await expect(page.getByText("Företag som matchar")).toBeVisible();
    await expect(page.getByLabel("Tjänst")).toHaveValue("Elektriker");
    await expect(page.getByLabel("Ort")).toHaveValue("Södertälje");
    await expect(page.getByText("Tjänsten känns inte igen ännu.", { exact: false })).toHaveCount(0);
    await expect(page.getByText("Positionen kunde inte tolkas.", { exact: false })).toHaveCount(0);

    url = new URL(page.url());
    expect(url.searchParams.get("service")).toBe("Elektriker");
    expect(url.searchParams.get("location")).toBe("Södertälje");
    expect(url.searchParams.get("page")).toBe("2");
  });
});
