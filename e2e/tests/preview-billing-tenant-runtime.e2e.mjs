import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";

const RUN_HEADER = "x-proffera-preview-e2e-run";
const fixturePath = "/api/e2e/marketplace/provider";
const billingEvidencePath = "/api/e2e/marketplace/billing";

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

async function billingRequest(request, suiteRunId, method) {
  const response = await request.fetch(billingEvidencePath, {
    method,
    headers: { [RUN_HEADER]: suiteRunId },
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function visibleControl(page, labels, selectors = [], timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      for (const label of labels) {
        const locator = frame.getByLabel(label, { exact: false }).first();
        if (await locator.count() > 0 && await locator.isVisible().catch(() => false)) return locator;
      }
      for (const selector of selectors) {
        const locator = frame.locator(selector).first();
        if (await locator.count() > 0 && await locator.isVisible().catch(() => false)) return locator;
      }
    }
    await page.waitForTimeout(250);
  }
  return null;
}

async function fillStripeField(page, labels, selectors, value) {
  const locator = await visibleControl(page, labels, selectors);
  expect(locator, `Missing Stripe field: ${labels.map((label) => label.source).join(", ")}`).not.toBeNull();
  await locator.fill(value);
}

async function selectStripeCountry(page) {
  const country = await visibleControl(
    page,
    [/Country or region/iu, /Country/iu, /Land eller region/iu, /Land/iu],
    ['select[name="billingCountry"]', 'select[autocomplete="country"]'],
    8_000,
  );
  if (!country) return;

  const tagName = await country.evaluate((element) => element.tagName.toLowerCase());
  if (tagName === "select") {
    await country.selectOption("SE");
    return;
  }

  await country.click();
  const option = page.getByRole("option", { name: /Sweden|Sverige/iu }).first();
  if (await option.count() > 0) await option.click();
}

async function completeStripeCheckout(page, checkoutUrl, email) {
  await page.goto(checkoutUrl, { waitUntil: "domcontentloaded" });

  await fillStripeField(page, [/Email/iu, /E-post/iu], ['input[type="email"]', 'input[name="email"]'], email);
  await fillStripeField(page, [/Card number/iu, /Kortnummer/iu], ['input[name="cardNumber"]', 'input[autocomplete="cc-number"]'], "4242424242424242");
  await fillStripeField(page, [/Expiration/iu, /Expiry/iu, /Utgång/iu], ['input[name="cardExpiry"]', 'input[autocomplete="cc-exp"]'], "1234");
  await fillStripeField(page, [/CVC/iu, /CVV/iu, /Säkerhetskod/iu], ['input[name="cardCvc"]', 'input[autocomplete="cc-csc"]'], "123");

  const name = await visibleControl(
    page,
    [/Name on card/iu, /Cardholder name/iu, /Namn på kort/iu],
    ['input[name="billingName"]', 'input[autocomplete="cc-name"]'],
    5_000,
  );
  if (name) await name.fill("Preview Billing Owner");

  await selectStripeCountry(page);

  const address = await visibleControl(
    page,
    [/Address line 1/iu, /Address/iu, /Adressrad 1/iu, /Adress/iu],
    ['input[name="billingAddressLine1"]', 'input[autocomplete="address-line1"]'],
    5_000,
  );
  if (address) await address.fill("Testgatan 1");

  const city = await visibleControl(
    page,
    [/City/iu, /Ort/iu, /Stad/iu],
    ['input[name="billingLocality"]', 'input[autocomplete="address-level2"]'],
    5_000,
  );
  if (city) await city.fill("Stockholm");

  const postalCode = await visibleControl(
    page,
    [/Postal code/iu, /ZIP/iu, /Postnummer/iu],
    ['input[name="billingPostalCode"]', 'input[autocomplete="postal-code"]'],
    5_000,
  );
  if (postalCode) await postalCode.fill("11122");

  const payButton = await visibleControl(
    page,
    [/^Subscribe(?: .*)?$/iu, /^Pay(?: .*)?$/iu, /^Start trial(?: .*)?$/iu, /^Prenumerera(?: .*)?$/iu, /^Betala(?: .*)?$/iu, /^Abonnera(?: .*)?$/iu],
    ['button[type="submit"]'],
  );
  expect(payButton, "Stripe Checkout submit button was not visible.").not.toBeNull();
  await payButton.click();

  await page.waitForURL(/\/dashboard\/installningar\?[^#]*billing=success/u, {
    timeout: 60_000,
    waitUntil: "domcontentloaded",
  });
}

async function waitForBillingSync(request, suiteRunId) {
  const deadline = Date.now() + 60_000;
  let latest = null;

  while (Date.now() < deadline) {
    const state = await billingRequest(request, suiteRunId, "GET");
    if (state.response.ok() && state.body?.ok) {
      latest = state.body;
      const billing = state.body.billing;
      if (
        (billing?.status === "active" || billing?.status === "trialing")
        && /^sub_/u.test(billing?.subscriptionId ?? "")
        && /^cus_/u.test(billing?.customerId ?? "")
        && billing?.lastEventCreated > 0
        && billing?.planKey === "starter"
        && (billing?.planStatus === "active" || billing?.planStatus === "trialing")
      ) {
        return state.body;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Stripe webhook did not reconcile Preview billing in time: ${JSON.stringify(latest)}`);
}

test.describe("isolated Preview billing/tenant runtime", () => {
  test.skip(process.env.E2E_MARKETPLACE_PREVIEW_LIFECYCLE !== "true", "Billing Preview runtime evidence is opt-in and Preview-only.");

  test("synthetic owner completes test Checkout through webhook-backed entitlement sync", async ({ page, context, request }) => {
    test.setTimeout(210_000);
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

      const validCheckout = await page.evaluate(async () => {
        const response = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "content-type": "application/json",
          },
          body: JSON.stringify({ planKey: "starter", lang: "sv" }),
        });
        return {
          status: response.status,
          body: await response.json().catch(() => null),
        };
      });

      expect(validCheckout.status, JSON.stringify(validCheckout.body)).toBe(200);
      expect(typeof validCheckout.body?.url).toBe("string");
      const checkoutUrl = new URL(validCheckout.body.url);
      expect(checkoutUrl.protocol).toBe("https:");
      expect(checkoutUrl.hostname).toBe("checkout.stripe.com");
      expect(checkoutUrl.href).toContain("cs_test_");

      const billingState = await billingRequest(request, suiteRunId, "GET");
      expect(billingState.response.ok(), JSON.stringify(billingState.body)).toBeTruthy();
      expect(billingState.body?.ok).toBe(true);
      expect(billingState.body?.billing?.status).toBe("pending");
      expect(billingState.body?.billing?.checkoutSessionId).toMatch(/^cs_test_/u);
      expect(billingState.body?.billing?.priceId).toMatch(/^price_/u);
      expect(checkoutUrl.href).toContain(billingState.body.billing.checkoutSessionId);
      await expect(page).toHaveURL(/\/dashboard\/installningar(?:\?|$)/u);

      await completeStripeCheckout(page, checkoutUrl.href, setup.body.ownerEmail);

      const reconciled = await waitForBillingSync(request, suiteRunId);
      expect(reconciled.billing.checkoutSessionId).toBe(billingState.body.billing.checkoutSessionId);
      expect(reconciled.billing.subscriptionId).toMatch(/^sub_/u);
      expect(reconciled.billing.customerId).toMatch(/^cus_/u);
      expect(reconciled.billing.status).toMatch(/^(active|trialing)$/u);
      expect(reconciled.billing.lastEventCreated).toBeGreaterThan(0);
      expect(reconciled.billing.planKey).toBe("starter");
      expect(reconciled.billing.planStatus).toMatch(/^(active|trialing)$/u);
      expect(new Date(reconciled.billing.currentPeriodEnd).getTime()).toBeGreaterThan(Date.now());
      expect(reconciled.entitlement.featureFlags).toMatchObject({
        ai_assistant: false,
        booking_demo: true,
        crm_customers: false,
        lead_inbox: true,
      });
    } finally {
      if (fixtureCreated) {
        await billingRequest(request, suiteRunId, "DELETE").catch(() => undefined);
        await fixtureRequest(request, suiteRunId, "DELETE").catch(() => undefined);
      }
    }
  });
});
