import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";

const RUN_HEADER = "x-proffera-preview-e2e-run";
const fixturePath = "/api/e2e/marketplace/provider";
const resetEmailPath = "/api/e2e/marketplace/password-reset-email";

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

async function resetEmail(request, suiteRunId) {
  const response = await request.get(resetEmailPath, {
    headers: { [RUN_HEADER]: suiteRunId },
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function cleanupResetVerification(request, suiteRunId) {
  return request.delete(resetEmailPath, {
    headers: { [RUN_HEADER]: suiteRunId },
  });
}

async function waitForFreshResetEmail(request, suiteRunId, baselineUuid) {
  const deadline = Date.now() + 60_000;
  let latest = null;
  let freshWithoutTarget = 0;

  while (Date.now() < deadline) {
    latest = await resetEmail(request, suiteRunId);
    const isFresh = latest.response.ok()
      && latest.body?.ok === true
      && latest.body?.found === true
      && latest.body?.uuid
      && latest.body.uuid !== baselineUuid;

    if (isFresh && latest.body?.resetTarget) return latest.body;

    if (isFresh && Number(latest.body?.diagnostics?.bodyLength ?? 0) > 0) {
      freshWithoutTarget += 1;
      if (freshWithoutTarget >= 2) {
        throw new Error(`Fresh Preview reset email had no trusted reset target: ${JSON.stringify(latest.body?.diagnostics ?? null)}`);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  expect(latest?.response.ok(), JSON.stringify(latest?.body ?? null)).toBeTruthy();
  throw new Error(`Timed out waiting for a fresh Preview password reset email with a trusted reset target: ${JSON.stringify(latest?.body?.diagnostics ?? null)}`);
}

test.describe("isolated Preview password reset lifecycle", () => {
  test.skip(process.env.E2E_MARKETPLACE_PREVIEW_LIFECYCLE !== "true", "Password reset Preview evidence is opt-in and Preview-only.");

  test("request -> Preview email -> token reset -> login with replacement password", async ({ page, context, request }) => {
    test.setTimeout(150_000);
    await context.addInitScript(() => {
      window.localStorage.setItem("proffera:analytics-consent:v1", "denied");
    });

    const suiteRunId = runId();
    const password = `Preview-${suiteRunId.slice(0, 12)}-A9!`;
    const replacementPassword = `Reset-${suiteRunId.slice(12, 24)}-B8!`;
    let fixtureCreated = false;

    try {
      const setup = await fixtureRequest(request, suiteRunId, "POST");
      expect(setup.response.ok(), JSON.stringify(setup.body)).toBeTruthy();
      expect(setup.body?.ok).toBe(true);
      fixtureCreated = true;

      await page.goto("/skapa-konto?plan=starter");
      await page.getByLabel("Ditt namn").fill("Preview Reset Owner");
      await page.getByLabel("Företagsnamn").fill(setup.body.companyName);
      await page.getByLabel("E-post").fill(setup.body.ownerEmail);
      await page.getByLabel("Lösenord").fill(password);
      await page.getByLabel("Ort").fill("Stockholm");
      await page.getByLabel("Telefon").fill("0701234567");
      await page.getByRole("button", { name: "Starta 14 dagar gratis" }).click();
      await page.waitForURL(/\/dashboard\/onboarding(?:\?|$)/u, { timeout: 30_000 });

      const baseline = await resetEmail(request, suiteRunId);
      expect(baseline.response.ok(), JSON.stringify(baseline.body)).toBeTruthy();
      expect(baseline.body?.ok).toBe(true);
      const baselineUuid = baseline.body?.found ? String(baseline.body.uuid ?? "") : "";

      await page.goto("/glomt-losenord");
      await page.getByLabel("E-post").fill(setup.body.ownerEmail);
      await page.getByRole("button", { name: "Skicka återställningslänk" }).click();
      await expect(page.getByRole("status")).toContainText("Om det finns ett konto med den e-postadressen");

      const email = await waitForFreshResetEmail(request, suiteRunId, baselineUuid);
      expect(email.subject).toBe("Återställ ditt lösenord på Proffera");
      expect(email.sinkRecipientMatched).toBe(true);
      expect(email.acceptedByProvider).toBe(true);
      expect(email.diagnostics?.verificationTokenFound).toBe(true);
      expect(email.diagnostics?.targetsConflict).toBe(false);
      expect(email.resetTarget).toMatch(/^\/aterstall-losenord(?:\?lang=en)?#token=[A-Za-z0-9_-]{16,128}$/u);

      await page.goto(email.resetTarget);
      await page.getByLabel("Nytt lösenord", { exact: true }).fill(replacementPassword);
      await page.getByLabel("Bekräfta nytt lösenord", { exact: true }).fill(replacementPassword);
      await page.getByRole("button", { name: "Spara nytt lösenord" }).click();
      await page.waitForURL(/\/logga-in\?reset=1(?:&|$)/u, { timeout: 30_000 });

      await page.getByLabel("E-post").fill(setup.body.ownerEmail);
      await page.getByLabel("Lösenord").fill(replacementPassword);
      await page.getByRole("button", { name: "Logga in" }).click();
      await page.waitForURL(/\/dashboard(?:\/|$|\?)/u, { timeout: 30_000 });

      await page.goto("/dashboard/marknadsplats");
      await expect(page).toHaveURL(/\/dashboard\/marknadsplats(?:\?|$)/u);
      await expect(page.getByRole("button", { name: "Logga ut" })).toBeVisible();
    } finally {
      if (fixtureCreated) {
        await cleanupResetVerification(request, suiteRunId).catch(() => undefined);
        await fixtureRequest(request, suiteRunId, "DELETE").catch(() => undefined);
      }
    }
  });
});
