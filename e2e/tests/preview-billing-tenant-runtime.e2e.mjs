import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";

const RUN_HEADER = "x-proffera-preview-e2e-run";
const fixturePath = "/api/e2e/marketplace/provider";

function runId() {
  return randomBytes(24).toString("hex");
}

async function fixtureRequest(request, suiteRunId, method) {
  const response = await request.fetch(fixturePath, {
    method,
    headers: { [RUN_HEADER]: suiteRunId },
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

test.describe("isolated Preview billing/tenant runtime", () => {
  test.skip(process.env.E2E_MARKETPLACE_PREVIEW_LIFECYCLE !== "true", "Billing Preview runtime evidence is opt-in and Preview-only.");

  test("synthetic owner sees Stripe Sandbox billing and guarded checkout rejects an invalid plan before Stripe", async ({ page, context, request }) => {
    test.setTimeout(90_000);
    await context.addInitScript(() => {
      window.localStorage.setItem("proffera:analytics-consent:v1", "denied");
    });

    const suiteRunId = runId();
    const password = `Preview-${suiteRunId.slice(0, 12)}-B7!`;
    let fixtureCreated = false;

    try {
      const setup = await fixtureRequest(request, suiteRunId, "POST");
      expect(setup.response.ok(), JSON.stringify(setup.body)).toBeTruthy();
      expect(setup.body?.ok).toBe(true);
      fixtureCreated = true;

      await page.goto("/skapa-konto?plan=starter");
      await page.getByLabel("Ditt namn").fill("Preview Billing Owner");
      await page.getByLabel("Företagsnamn").fill(setup.body.companyName);
      await page.getByLabel("E-post").fill(setup.body.ownerEmail);
      await page.getByLabel("Lösenord").fill(password);
      await page.getByLabel("Ort").fill("Stockholm");
      await page.getByLabel("Telefon").fill("0701234567");
      await page.getByRole("button", { name: "Starta 14 dagar gratis" }).click();
      await page.waitForURL(/\/dashboard\/onboarding(?:\?|$)/u, { timeout: 30_000 });

      await page.goto("/dashboard/installningar");
      await expect(page).toHaveURL(/\/dashboard\/installningar(?:\?|$)/u);
      await expect(page.getByRole("heading", { name: "Plan och betalning" })).toBeVisible();
      await expect(page.getByRole("note")).toContainText("Stripe Sandbox");
      await expect(page.getByRole("note")).toContainText("Inga riktiga pengar dras");
      await expect(page.getByText("199 kr/mån · Stripe Sandbox")).toBeVisible();
      await expect(page.getByText("599 kr/mån · Stripe Sandbox")).toBeVisible();
      await expect(page.getByText("1 kr/mån", { exact: false })).toHaveCount(0);

      const invalidCheckout = await page.evaluate(async () => {
        const response = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({ planKey: "not-a-plan", lang: "sv" }),
        });
        return {
          status: response.status,
          body: await response.json().catch(() => null),
        };
      });

      expect(invalidCheckout.status).toBe(400);
      expect(invalidCheckout.body?.error).toBe("Välj en tillgänglig plan.");
      await expect(page).toHaveURL(/\/dashboard\/installningar(?:\?|$)/u);
    } finally {
      if (fixtureCreated) {
        await fixtureRequest(request, suiteRunId, "DELETE").catch(() => undefined);
      }
    }
  });
});
