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

test.describe("isolated Preview login/session lifecycle", () => {
  test.skip(process.env.E2E_MARKETPLACE_PREVIEW_LIFECYCLE !== "true", "Auth Preview lifecycle is opt-in and Preview-only.");

  test("protected redirect -> signup session -> logout -> login -> protected access", async ({ page, context, request }) => {
    test.setTimeout(90_000);
    await context.addInitScript(() => {
      window.localStorage.setItem("proffera:analytics-consent:v1", "denied");
    });

    const suiteRunId = runId();
    const password = `Preview-${suiteRunId.slice(0, 12)}-A9!`;
    let fixtureCreated = false;

    try {
      await page.goto("/dashboard/marknadsplats");
      await page.waitForURL(/\/logga-in(?:\?|$)/u, { timeout: 30_000 });

      const setup = await fixtureRequest(request, suiteRunId, "POST");
      expect(setup.response.ok(), JSON.stringify(setup.body)).toBeTruthy();
      expect(setup.body?.ok).toBe(true);
      fixtureCreated = true;

      await page.goto("/skapa-konto?plan=starter");
      await page.getByLabel("Ditt namn").fill("Preview Auth Owner");
      await page.getByLabel("Företagsnamn").fill(setup.body.companyName);
      await page.getByLabel("E-post").fill(setup.body.ownerEmail);
      await page.getByLabel("Lösenord").fill(password);
      await page.getByLabel("Ort").fill("Stockholm");
      await page.getByLabel("Telefon").fill("0701234567");
      await page.getByRole("button", { name: "Starta 14 dagar gratis" }).click();
      await page.waitForURL(/\/dashboard\/onboarding(?:\?|$)/u, { timeout: 30_000 });

      await page.goto("/dashboard/marknadsplats");
      await expect(page.getByRole("button", { name: "Logga ut" })).toBeVisible();
      await page.getByRole("button", { name: "Logga ut" }).click();
      await page.waitForURL(/\/logga-in(?:\?|$)/u, { timeout: 30_000 });

      await page.getByLabel("E-post").fill(setup.body.ownerEmail);
      await page.getByLabel("Lösenord").fill(password);
      await page.getByRole("button", { name: "Logga in" }).click();
      await page.waitForURL(/\/dashboard(?:\/|$|\?)/u, { timeout: 30_000 });

      await page.goto("/dashboard/marknadsplats");
      await expect(page).toHaveURL(/\/dashboard\/marknadsplats(?:\?|$)/u);
      await expect(page.getByRole("button", { name: "Logga ut" })).toBeVisible();
    } finally {
      if (fixtureCreated) {
        await fixtureRequest(request, suiteRunId, "DELETE").catch(() => undefined);
      }
    }
  });
});
