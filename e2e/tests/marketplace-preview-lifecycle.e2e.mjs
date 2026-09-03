import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";

const RUN_HEADER = "x-proffera-preview-e2e-run";
const fixturePath = "/api/e2e/marketplace/fixture";
const emailPath = "/api/e2e/marketplace/email";

function runId() {
  return randomBytes(24).toString("hex");
}

function customerEmail(id) {
  return `marketplace-e2e-${id.slice(0, 24)}@customer.example.invalid`;
}

async function fixtureRequest(request, suiteRunId, method, path = fixturePath, data) {
  const response = await request.fetch(path, {
    method,
    headers: { [RUN_HEADER]: suiteRunId },
    ...(data === undefined ? {} : { data }),
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function stateFor(request, suiteRunId, runIds) {
  const query = new URLSearchParams({ runs: runIds.join(",") });
  const { response, body } = await fixtureRequest(
    request,
    suiteRunId,
    "GET",
    `${fixturePath}?${query.toString()}`,
  );
  expect(response.ok(), JSON.stringify(body)).toBeTruthy();
  expect(body?.ok).toBe(true);
  return body;
}

async function waitForState(request, suiteRunId, runIds, predicate, message) {
  let latest = null;
  await expect.poll(async () => {
    latest = await stateFor(request, suiteRunId, runIds);
    return predicate(latest) ? "ready" : "pending";
  }, {
    message,
    timeout: 90_000,
    intervals: [500, 1_000, 2_000, 5_000],
  }).toBe("ready");
  return latest;
}

async function waitForEmail(request, suiteRunId, kind, customerRunId) {
  let latest = null;
  await expect.poll(async () => {
    const query = new URLSearchParams({ kind, run: customerRunId });
    const { response, body } = await fixtureRequest(
      request,
      suiteRunId,
      "GET",
      `${emailPath}?${query.toString()}`,
    );
    if (!response.ok()) return `http-${response.status()}`;
    latest = body;
    return body?.found === true ? "found" : "pending";
  }, {
    message: `wait for ${kind} Preview email`,
    timeout: 120_000,
    intervals: [1_000, 2_000, 5_000],
  }).toBe("found");

  expect(latest?.sinkRecipientMatched).toBe(true);
  expect(latest?.originalRecipientObserved).toBe(false);
  expect(latest?.acceptedByProvider).toBe(true);
  expect(latest?.link).toMatch(/^https:\/\/[^/]+\.vercel\.app\//u);
  return latest;
}

async function fillRequiredSmartDetails(page) {
  const groups = page.locator("fieldset");
  const count = await groups.count();
  for (let index = 0; index < count; index += 1) {
    const group = groups.nth(index);
    const radios = group.getByRole("radio");
    if (await radios.count()) {
      await radios.first().check();
      continue;
    }
    const input = group.locator("input").first();
    if (!(await input.count())) continue;
    const type = await input.getAttribute("type");
    await input.fill(type === "number" ? "1" : "Preview E2E details");
  }
}

async function submitQuote(page, context, customerRunId, location, ordinal) {
  await context.setGeolocation({ latitude: location.latitude, longitude: location.longitude });
  await page.goto("/fa-offert");

  await page.getByLabel("Kategori").selectOption({ label: "VVS" });
  await page.getByLabel("Tjänstetyp").selectOption({ label: "VVS / rörmokare" });
  await page.getByRole("button", { name: "Fortsätt" }).click();

  await expect(page.getByText("Steg 2 av 6")).toBeVisible();
  await fillRequiredSmartDetails(page);
  await page.getByRole("button", { name: "Fortsätt" }).click();

  await expect(page.getByText("Steg 3 av 6")).toBeVisible();
  await page.getByRole("button", { name: "Nära mig" }).click();
  await expect(page.getByText("Position hittad. Vi använder den för att hitta rätt företag.")).toBeVisible();
  await page.getByLabel("Stad").fill(location.city);
  await page.getByLabel("Postnummer").fill(location.postalCode);
  await page.getByRole("button", { name: "Fortsätt" }).click();

  await page.getByLabel("Beskriv uppdraget").fill(`Preview E2E kund ${ordinal}: kontroll av ett syntetiskt VVS-uppdrag utan produktionsdata.`);
  await page.getByLabel("Önskad tidpunkt").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Fortsätt" }).click();

  await page.getByLabel("Namn").fill(`Preview Kund ${ordinal}`);
  await page.getByLabel("E-post").fill(customerEmail(customerRunId));
  await page.getByLabel("Telefon").fill(`07000000${ordinal}1`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Fortsätt" }).click();

  await expect(page.getByText("Steg 6 av 6")).toBeVisible();
  // The public anti-bot contract requires at least 2.5 seconds between form
  // mount and submission. Explicitly preserve that boundary in hosted Preview.
  await page.waitForTimeout(2_700);
  await page.getByRole("button", { name: "Skicka förfrågan" }).click();
  await expect(page.getByRole("heading", { name: "Förfrågan är skickad" })).toBeVisible({ timeout: 30_000 });
}

async function submitProviderOffer(page, link, ordinal) {
  const response = await page.goto(link);
  expect(response?.ok()).toBeTruthy();
  await page.getByLabel("Fast pris").check();
  await page.getByLabel("Pris / uppskattning i SEK").fill(String(1200 + ordinal * 100));
  await page.getByLabel("Tidigaste datum ni kan hjälpa kunden").fill("2026-09-15");
  await page.getByLabel("Kommentar till kunden").fill(`Preview E2E offert ${ordinal} utan verkliga kontaktuppgifter.`);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Skicka svar" }).click();
  await expect(page.getByText("Svar skickat")).toBeVisible({ timeout: 30_000 });
}

function tokenFromLink(link, segment) {
  const url = new URL(link);
  const prefix = `${segment}/`;
  expect(url.pathname.startsWith(prefix)).toBe(true);
  return decodeURIComponent(url.pathname.slice(prefix.length).split("/")[0] ?? "");
}

function mutateToken(token) {
  const first = token[0] === "A" ? "B" : "A";
  return `${first}${token.slice(1)}`;
}

function stateMap(snapshot) {
  return new Map((snapshot?.states ?? []).map((entry) => [entry.runId, entry.state]));
}

test.describe("isolated Marketplace Preview lifecycle", () => {
  test.skip(process.env.E2E_MARKETPLACE_PREVIEW_LIFECYCLE !== "true", "Full Marketplace lifecycle is opt-in and Preview-only.");

  test("Quote -> Matching -> Invitation -> Offer -> Selection -> Job -> Completed -> Verified Review", async ({ page, context, request, baseURL }) => {
    expect(baseURL).toBeTruthy();
    const origin = new URL(baseURL).origin;
    await context.grantPermissions(["geolocation"], { origin });

    const suiteRunId = runId();
    const customerA = runId();
    const customerB = runId();
    const customerRunIds = [customerA, customerB];
    let fixtureCreated = false;

    try {
      const setup = await fixtureRequest(request, suiteRunId, "POST");
      expect(setup.response.ok(), JSON.stringify(setup.body)).toBeTruthy();
      expect(setup.body?.ok).toBe(true);
      expect(setup.body?.isolation).toEqual({
        previewRuntime: true,
        databaseIsolated: true,
        previewEmailConfigured: true,
        controlledRecipientConfigured: true,
      });
      expect(setup.body?.location).toMatchObject({
        city: "Stockholm",
        municipality: "Stockholm",
        postalCode: "11100",
        latitude: 60,
        longitude: 0,
      });
      fixtureCreated = true;

      await submitQuote(page, context, customerA, setup.body.location, 1);
      await submitQuote(page, context, customerB, setup.body.location, 2);

      const quotesReady = await waitForState(
        request,
        suiteRunId,
        customerRunIds,
        (snapshot) => customerRunIds.every((id) => Boolean(stateMap(snapshot).get(id)?.referenceId)),
        "both synthetic Preview quotes are persisted",
      );
      const quotes = stateMap(quotesReady);
      const refA = quotes.get(customerA)?.referenceId;
      const refB = quotes.get(customerB)?.referenceId;
      expect(refA).toBeTruthy();
      expect(refB).toBeTruthy();
      expect(refA).not.toBe(refB);

      const worker = await fixtureRequest(request, suiteRunId, "PUT", fixturePath, { runIds: customerRunIds });
      expect(worker.response.ok(), JSON.stringify(worker.body)).toBeTruthy();
      expect(worker.body?.ok, JSON.stringify(worker.body)).toBe(true);
      expect(worker.body?.result?.sent, JSON.stringify(worker.body)).toBe(2);

      const guestA = await waitForEmail(request, suiteRunId, "guest", customerA);
      const guestB = await waitForEmail(request, suiteRunId, "guest", customerB);
      expect(guestA.link).not.toBe(guestB.link);

      await submitProviderOffer(page, guestA.link, 1);
      await submitProviderOffer(page, guestB.link, 2);

      const offersReady = await waitForState(
        request,
        suiteRunId,
        customerRunIds,
        (snapshot) => customerRunIds.every((id) => stateMap(snapshot).get(id)?.offerCount === 1),
        "each synthetic customer has exactly one offer",
      );
      for (const id of customerRunIds) {
        const state = stateMap(offersReady).get(id);
        expect(state?.offerCount).toBe(1);
        expect(state?.selectedOfferCount).toBe(0);
        expect(state?.jobCount).toBe(0);
        expect(state?.reviewInvitationCount).toBe(0);
        expect(state?.reviewCount).toBe(0);
      }

      const comparisonA = await waitForEmail(request, suiteRunId, "customer", customerA);
      const comparisonB = await waitForEmail(request, suiteRunId, "customer", customerB);
      expect(comparisonA.link).not.toBe(comparisonB.link);

      const compareA1 = await context.newPage();
      const compareA2 = await context.newPage();
      const compareB = await context.newPage();
      await Promise.all([
        compareA1.goto(comparisonA.link),
        compareA2.goto(comparisonA.link),
        compareB.goto(comparisonB.link),
      ]);
      await expect(compareA1.getByText(refA, { exact: true })).toBeVisible();
      await expect(compareA1.getByText(refB, { exact: true })).toHaveCount(0);
      await expect(compareB.getByText(refB, { exact: true })).toBeVisible();
      await expect(compareB.getByText(refA, { exact: true })).toHaveCount(0);

      const selectA1 = compareA1.getByRole("button", { name: "Välj denna offert" });
      const selectA2 = compareA2.getByRole("button", { name: "Välj denna offert" });
      await expect(selectA1).toBeVisible();
      await expect(selectA2).toBeVisible();
      await Promise.allSettled([selectA1.click(), selectA2.click()]);

      const selected = await waitForState(
        request,
        suiteRunId,
        customerRunIds,
        (snapshot) => {
          const map = stateMap(snapshot);
          return map.get(customerA)?.selectedOfferCount === 1 && map.get(customerA)?.jobCount === 1;
        },
        "duplicate customer selection resolves to exactly one ServiceJob",
      );
      const selectedMap = stateMap(selected);
      expect(selectedMap.get(customerA)?.selectedOfferCount).toBe(1);
      expect(selectedMap.get(customerA)?.jobCount).toBe(1);
      expect(selectedMap.get(customerB)?.selectedOfferCount).toBe(0);
      expect(selectedMap.get(customerB)?.jobCount).toBe(0);
      expect(selectedMap.get(customerB)?.reviewCount).toBe(0);

      const providerToken = tokenFromLink(guestA.link, "/offert/svara");
      const jobPage = await context.newPage();
      await jobPage.goto(`/offert/jobb/${encodeURIComponent(providerToken)}`);
      await expect(jobPage.getByRole("heading", { name: "Hantera det valda jobbet" })).toBeVisible();
      await expect(jobPage.getByText("accepted", { exact: true })).toBeVisible();

      await jobPage.getByRole("button", { name: "Starta jobbet" }).click();
      await expect(jobPage.getByText("in_progress", { exact: true })).toBeVisible();
      const beforeCompleted = await stateFor(request, suiteRunId, customerRunIds);
      expect(stateMap(beforeCompleted).get(customerA)?.reviewInvitationCount).toBe(0);
      expect(stateMap(beforeCompleted).get(customerA)?.reviewCount).toBe(0);

      await jobPage.getByLabel("Kort sammanfattning av utfört arbete").fill("Preview E2E: syntetiskt VVS-jobb slutfört utan produktionsdata.");
      await jobPage.getByRole("button", { name: "Markera slutfört" }).click();
      await expect(jobPage.getByText("completed", { exact: true })).toBeVisible();

      const completed = await waitForState(
        request,
        suiteRunId,
        customerRunIds,
        (snapshot) => {
          const state = stateMap(snapshot).get(customerA);
          return state?.completedJobCount === 1 && state?.reviewInvitationCount === 1;
        },
        "completed job creates exactly one review invitation",
      );
      expect(stateMap(completed).get(customerA)?.jobCount).toBe(1);
      expect(stateMap(completed).get(customerA)?.reviewCount).toBe(0);

      const reviewEmail = await waitForEmail(request, suiteRunId, "review", customerA);
      const reviewToken = tokenFromLink(reviewEmail.link, "/review/marketplace");
      const reviewPage = await context.newPage();
      await reviewPage.goto(reviewEmail.link);
      await expect(reviewPage.getByText("Verifierat Marketplace-omdöme")).toBeVisible();
      await reviewPage.waitForTimeout(2_700);
      await reviewPage.getByRole("button", { name: "5 av 5 stjärnor" }).click();
      await reviewPage.getByLabel("Ditt namn").fill("Preview Kund 1");
      await reviewPage.getByLabel("Berätta om din upplevelse").fill("Preview E2E verifierar att exakt ett syntetiskt omdöme kan registreras efter slutfört jobb.");
      await reviewPage.getByRole("checkbox").check();
      await reviewPage.getByRole("button", { name: "Skicka verifierat omdöme" }).click();
      await expect(reviewPage.getByText(/Tack\. Ditt verifierade omdöme har tagits emot/u)).toBeVisible({ timeout: 30_000 });

      const reviewed = await waitForState(
        request,
        suiteRunId,
        customerRunIds,
        (snapshot) => stateMap(snapshot).get(customerA)?.reviewCount === 1,
        "exactly one verified review is persisted",
      );
      expect(stateMap(reviewed).get(customerA)?.reviewCount).toBe(1);
      expect(stateMap(reviewed).get(customerA)?.jobCount).toBe(1);
      expect(stateMap(reviewed).get(customerB)?.jobCount).toBe(0);
      expect(stateMap(reviewed).get(customerB)?.reviewCount).toBe(0);

      const reused = await context.newPage();
      await reused.goto(reviewEmail.link);
      await expect(reused.getByRole("heading", { name: "Omdömet har redan skickats" })).toBeVisible();

      const invalid = await context.newPage();
      await invalid.goto(`/review/marketplace/${encodeURIComponent(mutateToken(reviewToken))}`);
      await expect(invalid.getByRole("heading", { name: "Omdömeslänken är ogiltig" })).toBeVisible();

      const afterTokens = await stateFor(request, suiteRunId, customerRunIds);
      expect(stateMap(afterTokens).get(customerA)?.reviewCount).toBe(1);
      expect(stateMap(afterTokens).get(customerB)?.reviewCount).toBe(0);

      const cleanupA = await fixtureRequest(request, suiteRunId, "DELETE", fixturePath, {
        runIds: [customerA],
        deleteProvider: false,
      });
      expect(cleanupA.response.ok(), JSON.stringify(cleanupA.body)).toBeTruthy();
      const afterCleanupA = await stateFor(request, suiteRunId, customerRunIds);
      expect(stateMap(afterCleanupA).get(customerA)).toBeNull();
      expect(stateMap(afterCleanupA).get(customerB)).not.toBeNull();
      expect(afterCleanupA.providerExists).toBe(true);

      const cleanupB = await fixtureRequest(request, suiteRunId, "DELETE", fixturePath, {
        runIds: [customerB],
        deleteProvider: true,
      });
      expect(cleanupB.response.ok(), JSON.stringify(cleanupB.body)).toBeTruthy();
      const afterCleanupAll = await stateFor(request, suiteRunId, customerRunIds);
      expect(stateMap(afterCleanupAll).get(customerA)).toBeNull();
      expect(stateMap(afterCleanupAll).get(customerB)).toBeNull();
      expect(afterCleanupAll.providerExists).toBe(false);
      fixtureCreated = false;
    } finally {
      if (fixtureCreated) {
        await fixtureRequest(request, suiteRunId, "DELETE", fixturePath, {
          runIds: customerRunIds,
          deleteProvider: true,
        }).catch(() => undefined);
      }
    }
  });
});