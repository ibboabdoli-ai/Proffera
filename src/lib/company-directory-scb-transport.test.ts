import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createScbCompanyRegistryTransportFromEnv,
  fetchScbCompanyRegistryHelpExamplesFromEnv,
  isRetryableScbTransportError,
  probeScbCompanyRegistryMetadataFromEnv,
  readScbCompanyRegistryResponse,
  renderScbCompanyRegistryQueryTemplate,
  type ScbResponseStream,
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

function fakeResponse(statusCode = 200) {
  const response = new EventEmitter() as EventEmitter & { statusCode?: number };
  response.statusCode = statusCode;
  return response as unknown as ScbResponseStream;
}

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

  it("uses the authenticated SCB help-page request shapes by default once credentials exist", () => {
    process.env.SCB_COMPANY_REGISTRY_PFX_BASE64 = Buffer.from("test-pfx").toString("base64");
    process.env.SCB_COMPANY_REGISTRY_PFX_PASSPHRASE = "test-passphrase";

    expect(createScbCompanyRegistryTransportFromEnv()).toEqual({
      fetchCompany: expect.any(Function),
      fetchWorkplaces: expect.any(Function),
    });
  });

  it("still allows explicit query-template overrides for the replacement API", () => {
    process.env.SCB_COMPANY_REGISTRY_PFX_BASE64 = Buffer.from("test-pfx").toString("base64");
    process.env.SCB_COMPANY_REGISTRY_PFX_PASSPHRASE = "test-passphrase";
    process.env.SCB_COMPANY_REGISTRY_COMPANY_QUERY_TEMPLATE = '{"orgnr":"{{ORGNR}}"}';
    process.env.SCB_COMPANY_REGISTRY_WORKPLACE_QUERY_TEMPLATE = '{"orgnr":"{{ORGNR}}"}';

    expect(createScbCompanyRegistryTransportFromEnv()).toEqual({
      fetchCompany: expect.any(Function),
      fetchWorkplaces: expect.any(Function),
    });
  });

  it("accepts a base64 certificate value with harmless line wrapping", () => {
    const encoded = Buffer.from("test-pfx").toString("base64");
    process.env.SCB_COMPANY_REGISTRY_PFX_BASE64 = `${encoded.slice(0, 4)}\n${encoded.slice(4)}`;
    process.env.SCB_COMPANY_REGISTRY_PFX_PASSPHRASE = "test-passphrase";

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

    expect(() => createScbCompanyRegistryTransportFromEnv())
      .toThrow("Invalid SCB company registry certificate encoding");
  });

  it("retries only transient SCB transport failures", () => {
    const reset = Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });
    expect(isRetryableScbTransportError(reset)).toBe(true);
    expect(isRetryableScbTransportError(new Error("SCB company registry request timed out"))).toBe(true);
    expect(isRetryableScbTransportError(new Error("SCB company registry response was aborted"))).toBe(true);
    expect(isRetryableScbTransportError(new Error("SCB company registry request failed with HTTP 503"))).toBe(true);
    expect(isRetryableScbTransportError(new Error("SCB company registry request failed with HTTP 429"))).toBe(true);
    expect(isRetryableScbTransportError(new Error("SCB company registry request failed with HTTP 404"))).toBe(false);
    expect(isRetryableScbTransportError(new Error("SCB company registry returned invalid JSON"))).toBe(false);
  });

  it("rejects instead of hanging when the SCB response stream errors", async () => {
    const response = fakeResponse();
    const pending = readScbCompanyRegistryResponse(response, () => undefined);

    (response as unknown as EventEmitter).emit("error", new Error("body failed"));

    await expect(pending).rejects.toThrow("body failed");
  });

  it("rejects instead of hanging when the SCB response stream is aborted", async () => {
    const response = fakeResponse();
    const pending = readScbCompanyRegistryResponse(response, () => undefined);

    (response as unknown as EventEmitter).emit("aborted");

    await expect(pending).rejects.toThrow("response was aborted");
  });
});
