import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";

const RUN_HEADER = "x-proffera-preview-e2e-run";
const fixturePath = "/api/e2e/marketplace/provider";
const emailPath = "/api/e2e/marketplace/provider-email";

function runId() {
  return randomBytes(24).toString("hex");
}

async function fixtureRequest(request, suiteRunId, method, data) {
  const response = await request.fetch(fixturePath, {
    method,
    headers: { [RUN_HEADER]: suiteRunId },
    ...(data === undefined ? {} : { data }),
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function waitForClaimEmail(request, suiteRunId) {
  let latest = null;
  await expect.poll(async () => {
    const response = await request.get(emailPath, { headers: { [RUN_HEADER]: suiteRunId } });
    latest = await response.json().catch(() => null);
    if (!response.ok()) return `http-${response.status()}`;
    return latest?.found === true ? "found" : "pending";
  }, {
    message: "wait for Preview provider claim verification email",
    timeout: 120_000,
    intervals: [1_000, 2_000, 5_000],
  }).toBe("found");

  expect(latest?.code).toMatch(/^\d{6}$/u);
  expect(latest?.sinkRecipientMatched).toBe(true);
  expect(latest?.originalRecipientObserved).toBe(false);
  expect(latest?.acceptedByProvider).toBe(true);
  return latest.code;
}

test.describe("isolated provider onboarding Preview lifecycle", () => {
  test.skip(process.env.E2E_MARKETPLACE_PREVIEW_LIFECYCLE !== "true", "Provider Preview lifecycle is opt-in and Preview-only.");

  test("signup -> official claim -> workspace link -> service and area activation", async ({ page, context, request }) => {
    test.setTimeout(5 * 60_000);
    await context.addInitScript(() => {
      window.localStorage.setItem("proffera:analytics-consent:v1", "denied");
    });

    const suiteRunId = runId();
    const password = `Preview-${suiteRunId.slice(0, 12)}-A9!`;
    let fixtureCreated = false;

    try {
      const setup = await fixtureRequest(request, suiteRunId, "POST");
      expect(setup.response.ok(), JSON.stringify(setup.body)).toBeTruthy();
      expect(setup.body?.ok).toBe(true);
      fixtureCreated = true;

      await page.goto("/skapa-konto?plan=starter");
      await page.getByLabel("Ditt namn").fill("Preview Provider Owner");
      await page.getByLabel("Företagsnamn").fill(setup.body.companyName);
      await page.getByLabel("E-post").fill(setup.body.ownerEmail);
      await page.getByLabel("Lösenord").fill(password);
      await page.getByLabel("Ort").fill("Stockholm");
      await page.getByLabel("Telefon").fill("0701234567");
      await page.getByRole("button", { name: "Starta 14 dagar gratis" }).click();
      await page.waitForURL(/\/dashboard\/onboarding(?:\?|$)/u, { timeout: 30_000 });

      await page.goto("/dashboard/marknadsplats");
      await expect(page.getByRole("heading", { name: "Aktivera företaget på Proffera" })).toBeVisible();
      await page.getByLabel("Organisationsnummer").fill(setup.body.organizationNumber);
      await page.getByRole("button", { name: "Hitta mitt företag" }).click();
      await page.waitForURL(new RegExp(`/foretag/claim/${setup.body.slug}(?:\\?|$)`, "u"), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: setup.body.companyName })).toBeVisible();

      await page.getByLabel("Din roll i företaget").fill("Ägare");
      await page.getByLabel("Företagsmejl").fill(setup.body.ownerEmail);
      await page.getByLabel("Telefonnummer").fill("0701234567");
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Skicka kod till företagsmejlen" }).click();
      await expect(page.getByText("Verifieringskod skickad", { exact: true })).toBeVisible({ timeout: 30_000 });

      const code = await waitForClaimEmail(request, suiteRunId);
      await page.getByLabel("Verifieringskod").fill(code);
      await page.getByRole("button", { name: "Verifiera mejl och skicka till granskning" }).click();
      await expect(page.getByText("Företagsmejlen är verifierad", { exact: true })).toBeVisible({ timeout: 30_000 });

      const approved = await fixtureRequest(request, suiteRunId, "PUT");
      expect(approved.response.ok(), JSON.stringify(approved.body)).toBeTruthy();
      expect(approved.body?.ok).toBe(true);
      expect(approved.body?.state?.claim?.status).toBe("claimed");
      expect(approved.body?.state?.profile?.claimedWorkspaceId).toBe(approved.body?.state?.workspace?.id);

      await page.goto("/dashboard/marknadsplats");
      await expect(page.getByText("Kopplat och verifierat", { exact: true })).toBeVisible();
      await expect(page.getByText(setup.body.companyName, { exact: true })).toBeVisible();
      await page.getByLabel("Kundens primära väg").selectOption("quote");
      await page.getByLabel("Serviceområde, radie i km").fill("37");
      await page.getByRole("button", { name: "Publicera på marknadsplatsen" }).click();
      await expect(page.getByText("Tjänsten är publicerad på marknadsplatsen.", { exact: true })).toBeVisible({ timeout: 30_000 });

      const finalState = await fixtureRequest(request, suiteRunId, "GET");
      expect(finalState.response.ok(), JSON.stringify(finalState.body)).toBeTruthy();
      expect(finalState.body?.ok).toBe(true);
      const state = finalState.body?.state;
      expect(state?.claim?.status).toBe("claimed");
      expect(state?.profile?.publicationStatus).toBe("claimed");
      expect(state?.profile?.claimedWorkspaceId).toBe(state?.workspace?.id);
      expect(state?.service).toMatchObject({
        publicStatus: "published",
        conversionMode: "quote",
        directoryServiceSlug: "vvs",
      });
      expect(state?.serviceArea).toMatchObject({
        serviceSlug: "vvs",
        radiusKm: 37,
        sourceType: "owner",
        publicVisible: true,
      });
      expect(state?.serviceArea?.confirmedAt).toBeTruthy();

      const cleanup = await fixtureRequest(request, suiteRunId, "DELETE");
      expect(cleanup.response.ok(), JSON.stringify(cleanup.body)).toBeTruthy();
      expect(cleanup.body?.ok).toBe(true);
      fixtureCreated = false;
    } finally {
      if (fixtureCreated) {
        await fixtureRequest(request, suiteRunId, "DELETE").catch(() => undefined);
      }
    }
  });
});
