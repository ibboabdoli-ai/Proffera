import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";

const RUN_HEADER = "x-proffera-preview-e2e-run";
const fixturePath = "/api/e2e/marketplace/fixture";

function runId() {
  return randomBytes(24).toString("hex");
}

function customerEmail(id) {
  return `marketplace-e2e-${id}@customer.example.invalid`;
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
  return new Map((body?.states ?? []).map((entry) => [entry.runId, entry.state]));
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

test.describe("isolated Marketplace Preview invalid request", () => {
  test.skip(process.env.E2E_MARKETPLACE_PREVIEW_LIFECYCLE !== "true", "Marketplace Preview evidence is opt-in and Preview-only.");

  test("invalid contact data fails clearly and is not persisted", async ({ page, context, request, baseURL }) => {
    test.setTimeout(2 * 60_000);
    expect(baseURL).toBeTruthy();
    const origin = new URL(baseURL).origin;
    await context.grantPermissions(["geolocation"], { origin });
    await context.addInitScript(() => {
      window.localStorage.setItem("proffera:analytics-consent:v1", "denied");
    });

    const suiteRunId = runId();
    const invalidCustomer = runId();
    let fixtureCreated = false;

    try {
      const setup = await fixtureRequest(request, suiteRunId, "POST");
      expect(setup.response.ok(), JSON.stringify(setup.body)).toBeTruthy();
      expect(setup.body?.ok).toBe(true);
      fixtureCreated = true;
      expect(setup.body?.isolation).toEqual({
        previewRuntime: true,
        databaseIsolated: true,
        previewEmailConfigured: true,
        controlledRecipientConfigured: true,
      });

      const location = setup.body?.location;
      expect(location).toMatchObject({ city: "Stockholm", postalCode: "11100" });
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

      await page.getByLabel("Beskriv uppdraget").fill("Preview E2E ogiltig förfrågan som aldrig får sparas i Preview-databasen.");
      await page.getByLabel("Önskad tidpunkt").selectOption({ index: 1 });
      await page.getByRole("button", { name: "Fortsätt" }).click();

      await page.getByLabel("Namn").fill("Preview Ogiltig Kund");
      await page.getByLabel("E-post").fill(customerEmail(invalidCustomer));
      await page.getByLabel("Telefon").fill("123");
      await page.getByRole("checkbox").check();
      await page.getByRole("button", { name: "Fortsätt" }).click();

      await expect(page.getByText("Ange telefonnummer.")).toBeVisible();
      await expect(page.getByText("Steg 6 av 6")).toHaveCount(0);

      const states = await stateFor(request, suiteRunId, [invalidCustomer]);
      expect(states.get(invalidCustomer)).toBeNull();
    } finally {
      if (fixtureCreated) {
        await fixtureRequest(request, suiteRunId, "DELETE", fixturePath, {
          runIds: [invalidCustomer],
          deleteProvider: true,
        }).catch(() => undefined);
      }
    }
  });
});
