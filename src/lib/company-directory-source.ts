import "server-only";

import { randomUUID } from "node:crypto";

import {
  classifyOrganizationKind,
  normalizeSniCode,
  type NormalizedDirectoryCandidate,
} from "@/lib/company-directory-policy";

type AnyRecord = Record<string, unknown>;
type Path = readonly string[];

export type CompanyDirectorySourceBatch = {
  items: NormalizedDirectoryCandidate[];
  nextCursor: string | null;
  provider: string;
};

const DEFAULT_PROVIDER = "bolagsverket_vardefulla_datamangder";
const DEFAULT_OAUTH_SCOPE = "vardefulla-datamangder:read";

function object(value: unknown): AnyRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : null;
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  const row = object(value);
  if (!row) return "";
  for (const key of [
    "text",
    "klartext",
    "namn",
    "name",
    "organisationsnamn",
    "foretagsnamn",
    "företagsnamn",
    "beskrivning",
    "description",
    "verksamhetsbeskrivning",
    "varde",
    "värde",
    "value",
    "kod",
    "code",
  ]) {
    if (key in row) {
      const nested = text(row[key]);
      if (nested) return nested;
    }
  }
  return "";
}

function bool(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = text(value).toLocaleLowerCase("sv-SE");
  return [
    "true",
    "1",
    "ja",
    "yes",
    "aktiv",
    "active",
    "verksam",
    "registrerad",
    "godkänd",
    "godkand",
  ].includes(normalized);
}

function first(source: AnyRecord, keys: string[]) {
  for (const key of keys) {
    if (key in source && source[key] !== null && source[key] !== undefined) return source[key];
  }
  return undefined;
}

function atPath(source: AnyRecord, path: Path): unknown {
  let current: unknown = source;
  for (const key of path) {
    const row = object(current);
    if (!row || !(key in row)) return undefined;
    current = row[key];
  }
  return current;
}

function firstPath(source: AnyRecord, paths: Path[]) {
  for (const path of paths) {
    const value = atPath(source, path);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function firstArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
}

function firstObject(value: unknown): AnyRecord | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const row = object(item);
      if (row) return row;
    }
    return null;
  }
  return object(value);
}

function deepValuesForKeyPattern(value: unknown, pattern: RegExp, depth = 0): unknown[] {
  if (depth > 6) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => deepValuesForKeyPattern(item, pattern, depth + 1));
  }
  const row = object(value);
  if (!row) return [];
  const found: unknown[] = [];
  for (const [key, nested] of Object.entries(row)) {
    if (pattern.test(key)) found.push(nested);
    if (nested && typeof nested === "object") found.push(...deepValuesForKeyPattern(nested, pattern, depth + 1));
  }
  return found;
}

function normalizeOrganizationNumber(value: unknown) {
  return text(value).replace(/\D/g, "");
}

function isPositiveRegistrationStatus(value: string) {
  const normalized = value.trim().toLocaleLowerCase("sv-SE");
  if (!normalized) return false;
  if (
    normalized.startsWith("ej ")
    || normalized.startsWith("inte ")
    || normalized.includes("inte registrerad")
    || normalized.includes("ej registrerad")
    || normalized.includes("avregistr")
    || normalized === "false"
    || normalized === "nej"
    || normalized === "no"
    || normalized === "0"
  ) return false;
  return normalized === "registrerad"
    || normalized === "godkänd"
    || normalized === "godkand"
    || normalized === "aktiv"
    || normalized === "active"
    || normalized === "verksam"
    || normalized.startsWith("registrerad ");
}

function hasDeregistrationEvidence(value: unknown, depth = 0): boolean {
  if (depth > 4 || value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.some((item) => hasDeregistrationEvidence(item, depth + 1));
  const row = object(value);
  if (row) return Object.values(row).some((item) => hasDeregistrationEvidence(item, depth + 1));
  const normalized = text(value).toLocaleLowerCase("sv-SE");
  return Boolean(normalized) && !["false", "0", "nej", "no", "null"].includes(normalized);
}

function nameFromRecord(row: AnyRecord) {
  const direct = text(firstPath(row, [
    ["legalName"],
    ["displayName"],
    ["organisationsnamn"],
    ["organisationsNamn"],
    ["foretagsnamn"],
    ["företagsnamn"],
    ["namn"],
    ["name"],
  ]));
  if (direct) return direct;

  const containers = [
    firstPath(row, [["organisationsnamn", "organisationsnamnLista"]]),
    firstPath(row, [["organisationsnamnLista"]]),
    firstPath(row, [["names"]]),
    firstPath(row, [["namnLista"]]),
  ];
  for (const container of containers) {
    for (const candidate of firstArray(container)) {
      const value = text(candidate);
      if (value) return value;
    }
  }
  return "";
}

function sniFromRecord(row: AnyRecord) {
  const directCode = text(firstPath(row, [
    ["primarySniCode"],
    ["sniKod"],
    ["snikod"],
    ["sni"],
    ["naringsgrenKod"],
    ["näringsgrenKod"],
  ]));
  const directLabel = text(firstPath(row, [
    ["primarySniLabel"],
    ["sniText"],
    ["sniTextSv"],
    ["naringsgrenText"],
    ["näringsgrenText"],
  ]));
  if (directCode) return { code: normalizeSniCode(directCode), label: directLabel };

  const containers = [
    firstPath(row, [["naringsgrenOrganisation", "naringsgrenLista"]]),
    firstPath(row, [["näringsgrenOrganisation", "näringsgrenLista"]]),
    firstPath(row, [["naringsgrenOrganisation"]]),
    firstPath(row, [["näringsgrenOrganisation"]]),
    firstPath(row, [["naringsgrenar"]]),
    firstPath(row, [["näringsgrenar"]]),
    firstPath(row, [["sniKoder"]]),
    firstPath(row, [["sniCodes"]]),
  ];

  for (const container of containers) {
    for (const value of firstArray(container)) {
      const item = object(value);
      const nestedList = item
        ? firstArray(first(item, ["naringsgrenLista", "näringsgrenLista", "sniKoder", "sniCodes"]))
        : [];
      const candidates = nestedList.length ? nestedList : [value];
      for (const candidate of candidates) {
        const candidateRow = object(candidate);
        const code = candidateRow
          ? text(first(candidateRow, ["kod", "code", "sniKod", "snikod", "näringsgrenKod", "naringsgrenKod"]))
          : text(candidate);
        if (!code) continue;
        return {
          code: normalizeSniCode(code),
          label: candidateRow
            ? text(first(candidateRow, ["klartext", "text", "namn", "name", "beskrivning", "description"]))
            : "",
        };
      }
    }
  }
  return { code: "", label: "" };
}

function addressFromRecord(row: AnyRecord) {
  const container = firstPath(row, [
    ["postadressOrganisation", "postadress"],
    ["postadressOrganisation"],
    ["organisationspostadress"],
    ["postadress"],
    ["address"],
    ["postalAddress"],
  ]);
  const address = firstObject(container) ?? row;
  const street1 = text(first(address, [
    "addressLine1",
    "utdelningsadress1",
    "gatuadress",
    "street",
    "streetAddress",
    "adressrad1",
  ]));
  const street2 = text(first(address, ["utdelningsadress2", "adressrad2", "addressLine2"]));
  return {
    addressLine1: [street1, street2].filter(Boolean).join(", "),
    postalCode: text(first(address, ["postalCode", "postnummer", "zip", "zipCode"])),
    city: text(first(address, ["city", "postort", "ort", "postalTown"])),
    municipality: text(firstPath(row, [["municipality"], ["kommun"], ["kommunnamn"]])),
    region: text(firstPath(row, [["region"], ["lan"], ["län"], ["lansnamn"], ["länsnamn"]])),
  };
}

function statusFromValues(values: unknown[]) {
  for (const value of values) {
    if (typeof value === "boolean") return value ? "Registrerad" : "Ej registrerad";
    if (bool(value)) return "Registrerad";
    const normalized = text(value);
    if (normalized) return normalized;
  }
  return "";
}

function taxStatus(row: AnyRecord, keys: string[], deepPattern: RegExp) {
  const direct = first(row, keys);
  if (direct !== undefined && direct !== null) {
    if (typeof direct === "boolean") return direct ? "Registrerad" : "Ej registrerad";
    return bool(direct) ? "Registrerad" : text(direct);
  }
  return statusFromValues(deepValuesForKeyPattern(first(row, ["verksamOrganisation", "verksam_organisation"]) ?? row, deepPattern));
}

function normalizeSourceRecord(row: AnyRecord, provider: string): NormalizedDirectoryCandidate | null {
  const organizationNumber = normalizeOrganizationNumber(firstPath(row, [
    ["organizationNumber"],
    ["organisationNumber"],
    ["organisationsnummer"],
    ["identitetsbeteckning"],
    ["organisationsidentitet", "identitetsbeteckning"],
    ["organizationIdentity", "identifier"],
    ["identity"],
    ["orgNumber"],
  ]));
  if (organizationNumber.length !== 10) return null;

  const legalFormValue = firstPath(row, [
    ["legalForm"],
    ["juridiskForm", "klartext"],
    ["juridiskForm"],
    ["organisationsform", "klartext"],
    ["organisationsform", "organisationsform"],
    ["organisationsform"],
    ["organizationForm"],
  ]);
  const legalForm = text(legalFormValue);
  const legalName = nameFromRecord(row);
  const sni = sniFromRecord(row);
  const address = addressFromRecord(row);

  const fTaxStatus = taxStatus(row, ["fTaxStatus", "fSkatt", "f_skatt", "fskatt"], /f.?skatt/i);
  const vatStatus = taxStatus(row, ["vatStatus", "momsregistrerad", "momsreg", "vatRegistered"], /moms|vat/i);
  const employerStatus = taxStatus(row, ["employerStatus", "arbetsgivarregistrerad", "arbetsgivarreg", "employerRegistered"], /arbetsgivar|employer/i);

  const activeValue = firstPath(row, [
    ["isActive"],
    ["verksamOrganisation", "verksam"],
    ["verksamOrganisation", "aktiv"],
    ["verksam_organisation"],
    ["active"],
    ["statusAktiv"],
  ]);
  const deregistered = firstPath(row, [
    ["avregistreradOrganisation"],
    ["avregistrerad"],
    ["deregisteredAt"],
  ]);
  const hasActiveTaxRegistration = [fTaxStatus, vatStatus, employerStatus]
    .some(isPositiveRegistrationStatus);
  const isActive = hasDeregistrationEvidence(deregistered)
    ? false
    : activeValue !== undefined
      ? bool(activeValue)
      : hasActiveTaxRegistration;

  const sourceUpdatedRaw = text(firstPath(row, [
    ["sourceUpdatedAt"],
    ["updatedAt"],
    ["andradTidpunkt"],
    ["ändradTidpunkt"],
    ["lastUpdated"],
    ["hamtat"],
    ["hämtat"],
  ]));
  const parsedUpdated = sourceUpdatedRaw ? new Date(sourceUpdatedRaw) : null;

  const activityDescription = text(firstPath(row, [
    ["activityDescription"],
    ["verksamhetsbeskrivning", "verksamhetsbeskrivning"],
    ["verksamhetsbeskrivning", "beskrivning"],
    ["verksamhetsbeskrivning"],
    ["businessDescription"],
    ["description"],
  ]));

  return {
    countryCode: (text(first(row, ["countryCode", "registreringsland", "country"])) || "SE").toUpperCase().slice(0, 2),
    organizationNumber,
    organizationKind: classifyOrganizationKind(legalForm),
    legalName,
    displayName: text(first(row, ["displayName", "marketingName"])) || legalName,
    legalForm,
    organizationStatus: text(firstPath(row, [
      ["organizationStatus"],
      ["status"],
      ["registreringsstatus"],
      ["registrationStatus"],
      ["registreradOrganisation", "status"],
    ])),
    isActive,
    fTaxStatus,
    vatStatus,
    employerStatus,
    primarySniCode: sni.code,
    primarySniLabel: sni.label,
    activityDescription,
    ...address,
    officialSource: provider,
    sourceRecordId: text(first(row, ["sourceRecordId", "id", "recordId"])) || organizationNumber,
    sourceUpdatedAt: parsedUpdated && Number.isFinite(parsedUpdated.getTime()) ? parsedUpdated : null,
  };
}

function sourceItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const row = object(payload);
  if (!row) return [];
  for (const key of [
    "items",
    "data",
    "results",
    "organisations",
    "organisationer",
    "foretag",
    "företag",
    "records",
  ]) {
    if (Array.isArray(row[key])) return row[key] as unknown[];
  }
  return [row];
}

function detailRecord(payload: unknown): AnyRecord | null {
  const root = object(payload);
  if (!root) return null;
  for (const key of ["organisationer", "organisations", "organizations", "items", "results"]) {
    const candidate = firstObject(root[key]);
    if (candidate) return candidate;
  }
  for (const key of ["organisation", "organization", "data", "result", "foretag", "företag"]) {
    const nested = object(root[key]);
    if (nested) return nested;
  }
  return root;
}

function nextCursorFromPayload(payload: unknown) {
  const row = object(payload);
  if (!row) return null;
  const value = first(row, ["nextCursor", "next_cursor", "cursorNext", "nextPageToken"]);
  return text(value) || null;
}

async function oauthAccessToken() {
  const staticToken = process.env.COMPANY_DIRECTORY_SOURCE_BEARER_TOKEN?.trim();
  if (staticToken) return staticToken;

  const tokenUrl = process.env.COMPANY_DIRECTORY_TOKEN_URL?.trim();
  const clientId = process.env.BOLAGSVERKET_CLIENT_ID?.trim();
  const clientSecret = process.env.BOLAGSVERKET_CLIENT_SECRET?.trim();
  if (!tokenUrl || !clientId || !clientSecret) return "";

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const scope = process.env.COMPANY_DIRECTORY_OAUTH_SCOPE?.trim() || DEFAULT_OAUTH_SCOPE;
  const body = new URLSearchParams({ grant_type: "client_credentials", scope });
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Company directory OAuth failed (${response.status})`);
  const payload = object(await response.json());
  const token = payload ? text(payload.access_token) : "";
  if (!token) throw new Error("Company directory OAuth response did not contain access_token");
  return token;
}

function withCursor(urlString: string, cursor: string, limit: number) {
  const url = new URL(urlString);
  if (cursor) url.searchParams.set("cursor", cursor);
  url.searchParams.set("limit", String(limit));
  return url;
}

function replaceOrganizationNumber(template: string, organizationNumber: string) {
  const normalized = organizationNumber.replace(/\D/g, "");
  return template.replaceAll("{organizationNumber}", encodeURIComponent(normalized));
}

function mergeVerifiedCandidate(discovered: NormalizedDirectoryCandidate, verified: NormalizedDirectoryCandidate) {
  const pick = (verifiedValue: string, discoveredValue: string) => verifiedValue.trim() || discoveredValue;
  return {
    ...discovered,
    ...verified,
    countryCode: pick(verified.countryCode, discovered.countryCode),
    organizationNumber: verified.organizationNumber || discovered.organizationNumber,
    legalName: pick(verified.legalName, discovered.legalName),
    displayName: pick(verified.displayName, discovered.displayName),
    legalForm: pick(verified.legalForm, discovered.legalForm),
    organizationStatus: pick(verified.organizationStatus, discovered.organizationStatus),
    fTaxStatus: pick(verified.fTaxStatus, discovered.fTaxStatus),
    vatStatus: pick(verified.vatStatus, discovered.vatStatus),
    employerStatus: pick(verified.employerStatus, discovered.employerStatus),
    primarySniCode: pick(verified.primarySniCode, discovered.primarySniCode),
    primarySniLabel: pick(verified.primarySniLabel, discovered.primarySniLabel),
    activityDescription: pick(verified.activityDescription, discovered.activityDescription),
    addressLine1: pick(verified.addressLine1, discovered.addressLine1),
    postalCode: pick(verified.postalCode, discovered.postalCode),
    city: pick(verified.city, discovered.city),
    municipality: pick(verified.municipality, discovered.municipality),
    region: pick(verified.region, discovered.region),
    sourceRecordId: verified.sourceRecordId || discovered.sourceRecordId,
    sourceUpdatedAt: verified.sourceUpdatedAt ?? discovered.sourceUpdatedAt,
  } satisfies NormalizedDirectoryCandidate;
}

export async function fetchOfficialCompanyDirectoryBatch(input: { cursor?: string; limit?: number } = {}): Promise<CompanyDirectorySourceBatch> {
  const sourceUrl = process.env.COMPANY_DIRECTORY_SOURCE_URL?.trim();
  if (!sourceUrl) throw new Error("COMPANY_DIRECTORY_SOURCE_URL is not configured");

  const provider = process.env.COMPANY_DIRECTORY_PROVIDER?.trim() || DEFAULT_PROVIDER;
  const limit = Math.max(1, Math.min(100, input.limit ?? Number(process.env.COMPANY_DIRECTORY_BATCH_SIZE || 20)));
  const token = await oauthAccessToken();
  const response = await fetch(withCursor(sourceUrl, input.cursor ?? "", limit), {
    headers: {
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "x-request-id": randomUUID(),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Company directory source failed (${response.status})`);

  const payload = await response.json();
  const items = sourceItems(payload)
    .map((value) => object(value))
    .filter((value): value is AnyRecord => Boolean(value))
    .map((value) => normalizeSourceRecord(value, provider))
    .filter((value): value is NormalizedDirectoryCandidate => Boolean(value));

  return { items, nextCursor: nextCursorFromPayload(payload), provider };
}

export async function verifyOfficialCompanyCandidate(candidate: NormalizedDirectoryCandidate) {
  const template = process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE?.trim();
  if (!template) return candidate;

  const token = await oauthAccessToken();
  const method = process.env.COMPANY_DIRECTORY_DETAIL_METHOD?.trim().toUpperCase() === "GET" ? "GET" : "POST";
  const organizationNumber = candidate.organizationNumber.replace(/\D/g, "");
  const url = replaceOrganizationNumber(template, organizationNumber);
  const bodyTemplate = process.env.COMPANY_DIRECTORY_DETAIL_BODY_TEMPLATE?.trim();
  const body = method === "POST"
    ? (bodyTemplate
      ? replaceOrganizationNumber(bodyTemplate, organizationNumber)
      : JSON.stringify({ identitetsbeteckning: organizationNumber }))
    : undefined;

  const response = await fetch(url, {
    method,
    headers: {
      accept: "application/json",
      ...(method === "POST" ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "x-request-id": randomUUID(),
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Official company verification failed (${response.status})`);

  const row = detailRecord(await response.json());
  if (!row) throw new Error("Official company verification returned no record");
  const provider = `${candidate.officialSource}:detail`;
  const verified = normalizeSourceRecord(row, provider);
  if (!verified) throw new Error("Official company verification record could not be normalized");
  if (verified.organizationNumber !== organizationNumber) {
    throw new Error("Official company verification returned a different organization number");
  }

  return mergeVerifiedCandidate(candidate, verified);
}
