import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createScbCompanyRegistryTransportFromEnv,
  fetchScbCompanyRegistryHelpExamplesFromEnv,
  probeScbCompanyRegistryMetadataFromEnv,
  renderScbCompanyRegistryQueryTemplate,
} from "./company-directory-scb-transport";

const ENV_KEYS = [
  "SCB_COMPANY_REGISTRY_BASE_URL",
  "SCB_COMPANY_REGISTRY_PFX_BASE64",
  "SCB_COMPANY_REGISTRY_PFX_PASSPHRASE",
  "SCB_COMPANY_REGISTRY_TIMEOUT_MS",
  "SCB_COMPANY_REGISTRY_COMPANY_QUERY_TEMPLATE",
  "SCB_COMPANY_REGISTRY_WORKPLACE_QUERY_TEMPLATE",
] as const;

const initialEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = initialEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("SCB company registry transport", () => {
  it("renders only explicit organisation-number placeholders into valid JSON", () => {
    expect(renderScbCompanyRegistryQueryTemplate(
      '{"orgnr":"{{ORGNR}}","peorgnr":"{{PEORGNR}}"}',
      "556311-5707",
    )).toEqual({
      orgnr: "5563115707",
      peorgnr: "165563115707",
    });
  });

  it("rejects invalid organisation numbers and invalid templates", () => {
    expect(() => renderScbCompanyRegistryQueryTemplate('{"orgnr":"{{ORGNR}}"}', "123"))
      .toThrow("Invalid organization number");
    expect(() => renderScbCompanyRegistryQueryTemplate("not-json", "5563115707"))
      .toThrow("Invalid SCB company registry query template JSON");
    expect(() => renderScbCompanyRegistryQueryTemplate("[]", "5563115707"))
      .toThrow("must render to a JSON object");
  });

  it("keeps the live transport unavailable until both authenticated SCB query templates are configured", () => {
    process.env.SCB_COMPANY_REGISTRY_PFX_BASE64 = Buffer.from("test-pfx").toString("base64");
    process.env.SCB_COMPANY_REGISTRY_PFX_PASSPHRASE = "test-passphrase";

    expect(createScbCompanyRegistryTransportFromEnv()).toBeNull();

    process.env.SCB_COMPANY_REGISTRY_COMPANY_QUERY_TEMPLATE = '{"orgnr":"{{ORGNR}}"}';
    process.env.SCB_COMPANY_REGISTRY_WORKPLACE_QUERY_TEMPLATE = '{"orgnr":"{{ORGNR}}"}';

    expect(createScbCompanyRegistryTransportFromEnv()).toEqual({
      fetchCompany: expect.any(Function),
      fetchWorkplaces: expect.any(Function),
    });
  });

  it("allows read-only metadata/help probes to stay not configured without certificate credentials", async () => {
    await expect(probeScbCompanyRegistryMetadataFromEnv()).resolves.toEqual({ status: "not_configured" });
    await expect(fetchScbCompanyRegistryHelpExamplesFromEnv()).resolves.toEqual({ status: "not_configured" });
  });

  it("rejects malformed certificate base64 before creating a transport", () => {
    process.env.SCB_COMPANY_REGISTRY_PFX_BASE64 = "%%%not-base64%%%";
    process.env.SCB_COMPANY_REGISTRY_PFX_PASSPHRASE = "test-passphrase";
    process.env.SCB_COMPANY_REGISTRY_COMPANY_QUERY_TEMPLATE = '{"orgnr":"{{ORGNR}}"}';
    process.env.SCB_COMPANY_REGISTRY_WORKPLACE_QUERY_TEMPLATE = '{"orgnr":"{{ORGNR}}"}';

    expect(() => createScbCompanyRegistryTransportFromEnv())
      .toThrow("Invalid SCB company registry certificate encoding");
  });
});
