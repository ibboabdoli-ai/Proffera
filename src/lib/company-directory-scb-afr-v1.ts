import "server-only";

import { normalizeScbCompanyRegistryPayload } from "./company-directory-scb-provider";
import type { ScbCompanyRegistryEnrichment } from "./company-directory-scb-provider";

/**
 * SCB AFR v1, bounded Preview-only adapter.
 *
 * SCB's current public OpenAPI describes a legal-entity lookup by peOrgNr and
 * workplace lookup by CFAR number. It does NOT describe a complete AE-by-peOrgNr
 * query. Only explicit CFAR IDs from previously verified evidence may be used;
 * never infer that an incomplete AE lookup proves a single physical workplace.
 *
 * Deliberately not wired into automatic Directory revalidation or Production.
 * https://apiafr.scb.se/swagger/v1/swagger.json
 */
const BASE_URL = "https://apiafr.scb.se/v1/";
const MAX_BODY_BYTES = 256 * 1024;
const MAX_WORKPLACES = 25;
const TIMEOUT_MS = 12_000;

type JsonRecord = Record<string, unknown>;
type Fetcher = typeof fetch;

export type ScbAfrV1PreviewOptions = {
  /** Injection is test-only; callers should omit this in Preview. */
  fetcher?: Fetcher;
};

function record(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("SCB AFR v1 returned an invalid record");
  }
  return value as JsonRecord;
}

function objectOrEmpty(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord : {};
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`SCB AFR v1 missing ${label}`);
  }
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function organizationNumber(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!/^\d{10}$/.test(digits)) throw new Error("SCB AFR v1 requires a 10-digit organization number");
  return digits;
}

function cfarNumbers(input: readonly string[]): string[] {
  if (!input.length || input.length > MAX_WORKPLACES) {
    throw new Error("SCB AFR v1 requires a bounded complete set of known CFAR numbers");
  }
  const result = input.map((value) => {
    const digits = value.trim();
    if (!/^\d{8}$/.test(digits)) throw new Error("SCB AFR v1 requires 8-digit CFAR numbers");
    return digits;
  });
  if (new Set(result).size !== result.length) throw new Error("SCB AFR v1 CFAR numbers must be unique");
  return result;
}

function sniFields(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) throw new Error("SCB AFR v1 missing industry classification array");
  const result: Record<string, string> = {};
  for (const item of value) {
    const row = record(item);
    const rank = row.rangordning;
    const code = optionalText(row.naringsgren);
    if (typeof rank === "number" && Number.isInteger(rank) && rank >= 1 && rank <= 5 && code) {
      result[`SNI-kod-${rank}`] = code;
    }
  }
  return result;
}

function postAddress(value: unknown) {
  const address = objectOrEmpty(value);
  return {
    COadress: optionalText(address.coAdress),
    Postadress: optionalText(address.gatuAdress),
    PostNr: optionalText(address.postNr),
    PostOrt: optionalText(address.postOrt),
  };
}

function companyRecord(payload: unknown, expected: string): JsonRecord {
  const company = record(payload);
  if (company.peOrgNr !== `16${expected}` || company.orgNr !== expected) {
    throw new Error("SCB AFR v1 legal entity organization number mismatch");
  }
  if (typeof company.aeAnt !== "number" || !Number.isInteger(company.aeAnt) || company.aeAnt <= 0) {
    throw new Error("SCB AFR v1 legal entity workplace count is unavailable");
  }
  return {
    OrgNr: expected,
    Företagsnamn: requiredText(company.namn, "legal entity name"),
    Kommun: optionalText(company.kommunSate),
    ...postAddress(company.postAdress),
    ...sniFields(company.naringsgrenar),
    // Do not project telephone or email before block/suppression semantics are verified.
  };
}

function workplaceRecord(payload: unknown, expectedOrg: string, expectedCfar: string): JsonRecord {
  const workplace = record(payload);
  if (workplace.peOrgNr !== `16${expectedOrg}` || String(workplace.cfarNr) !== expectedCfar) {
    throw new Error("SCB AFR v1 workplace ownership/CFAR mismatch");
  }
  if (workplace.aeStat !== 1) throw new Error("SCB AFR v1 workplace is not active");
  const visiting = objectOrEmpty(workplace.belagenhetsadress);
  const geo = objectOrEmpty(workplace.geografiskInformation);
  return {
    PeOrgNr: workplace.peOrgNr,
    CfarNr: expectedCfar,
    Benämning: optionalText(workplace.ben),
    BesöksAdress: optionalText(visiting.bGatuAdress),
    BesöksPostNr: optionalText(visiting.bPostNr),
    BesöksPostOrt: optionalText(visiting.bPostOrt),
    Kommun: optionalText(visiting.kommun),
    Nordkoordinat: geo.nordKoordinatSW,
    Ostkoordinat: geo.ostKoordinatSW,
    ...postAddress(workplace.postAdress),
    ...sniFields(workplace.naringsgrenar),
  };
}

async function readBoundedJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(`SCB AFR v1 request failed with HTTP ${response.status}`);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("SCB AFR v1 returned a non-JSON response");
  }
  if (!response.body) throw new Error("SCB AFR v1 response body is missing");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("SCB AFR v1 response exceeded size limit");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const buffer = new Uint8Array(bytes);
  let index = 0;
  for (const part of chunks) { buffer.set(part, index); index += part.length; }
  try { return JSON.parse(new TextDecoder().decode(buffer)) as unknown; }
  catch { throw new Error("SCB AFR v1 returned invalid JSON"); }
}

export function scbAfrV1PreviewAccessReady(): boolean {
  return process.env.VERCEL_ENV === "preview"
    && process.env.SCB_COMPANY_REGISTRY_AFR_V1_PREVIEW_ENABLED === "true"
    && Boolean(process.env.SCB_COMPANY_REGISTRY_API_KEY?.trim());
}

/**
 * A read-only verification operation, not a new scheduler or publishing pathway.
 * Must not use Production's DB, write SCB snapshots or auto-publish records.
 */
export async function fetchScbAfrV1PreviewEvidence(
  requestedOrg: string,
  knownCompleteCfarNumbers: readonly string[],
  options: ScbAfrV1PreviewOptions = {},
): Promise<ScbCompanyRegistryEnrichment> {
  if (!scbAfrV1PreviewAccessReady()) throw new Error("SCB AFR v1 Preview access is disabled");
  const key = process.env.SCB_COMPANY_REGISTRY_API_KEY!.trim();
  const org = organizationNumber(requestedOrg);
  const cfars = cfarNumbers(knownCompleteCfarNumbers);
  const request = options.fetcher ?? fetch;

  const read = async (path: string): Promise<unknown> => {
    const response = await request(new URL(path, BASE_URL), {
      method: "GET",
      headers: { "X-API-Key": key, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return await readBoundedJson(response);
  };

  // Serial requests: even a Preview proof should not burst against the SCB API.
  const companyPayload = await read(`juridiskaenheter/16${org}/full`);
  const company = record(companyPayload);
  // AE-by-organization is not in the public v1 contract. aeAnt is therefore
  // indispensable to proving the supplied CFAR list is complete.
  if (company.aeAnt !== cfars.length) {
    throw new Error("SCB AFR v1 known CFAR evidence does not cover all company workplaces");
  }
  const workplaces: JsonRecord[] = [];
  for (const cfar of cfars) {
    workplaces.push(workplaceRecord(await read(`arbetsstallen/${cfar}/full`), org, cfar));
  }
  return normalizeScbCompanyRegistryPayload([companyRecord(company, org)], workplaces, org);
}
