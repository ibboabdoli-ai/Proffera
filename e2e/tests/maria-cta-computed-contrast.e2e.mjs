import { test, expect } from "@playwright/test";

test("both Maria demo actions keep readable computed colors after the full cascade", async ({ page }) => {
  await page.goto("/demo/makeup-by-maria-v2.html", { waitUntil: "domcontentloaded" });
  for (const selector of ["button.confirm", "#bookingCompleteAgain"]) {
    const styles = await page.locator(selector).evaluate(element => {
      const computed = getComputedStyle(element);
      return {
        background: computed.backgroundColor,
        color: computed.color,
        webkitFill: computed.getPropertyValue("-webkit-text-fill-color").trim(),
      };
    });
    // Inspect the elements, not matching CSS text; later cascade overrides
    // must fail this regression, including WebKit text fill overrides.
    expect(styles.background, selector).toBe("rgb(132, 83, 99)");
    expect(styles.color, selector).toBe("rgb(255, 255, 255)");
    expect(styles.webkitFill, selector).toBe("rgb(255, 255, 255)");
  }
});
