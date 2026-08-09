import "server-only";

import {
  classifyOrganizationKind,
  normalizeSniCode,
  type NormalizedDirectoryCandidate,
} from "@/lib/company-directory-policy";

type AnyRecord = Record<string, unknown>;

export type CompanyDirectorySourceBatch = {
  items: NormalizedDirectoryCandidate[];
  nextCursor: string | null;
  provider: string;
};

function object(value: unknown): AnyRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : null;
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  const row = object(value);
  if (!row) return "";
  return text(row.text ?? row.namn ?? row.name ?? row.beskrivning ?? row.description ?? row.varde ?? row.value ?? row.kod ?? row.code);
}

function bool(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = text(value).toLocaleLowerCase("sv-SE");
  return ["true", "1", "ja", "yes", "aktiv", "active", "verksam", "registrerad", "godkänd", "godkand"].includes(normalized);
}

function first(source: AnyRecord, keys: string[]) {
  for (const key of keys) {
    if (key in source && source[key] !== null && source[key] !== undefined) return source[key];
  }
  return undefined;
}

function firstArray(value: unknown) {
  return Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
}

function nameFromRecord(row: AnyRecord) {
  const direct = text(first(row, ["legalName", "displayName", "organisationsnamn", "organisationsNamn", "foretagsnamn", "företagsnamn", "namn", "name"]));
  if (direct) return direct;
  const names = firstArray(first(row, ["organisationsnamnLista", "organisationsnamn", "names", "namnLista"]));
  for (const candidate of names) {
    const value = text(candidate);
    if (value) return value;
  }
  return "";
}

function sniFromRecord(row: AnyRecord) {
  const directCode = text(first(row, ["primarySniCode", "sniKod", "snikod", "sni", "naringsgrenKod", "näringsgrenKod"]));
  const directLabel = text(first(row, ["primarySniLabel", "sniText", "sniTextSv", "naringsgrenText", "näringsgrenText"]));
  if (directCode) return { code: normalizeSniCode(directCode), label: directLabel };

  const values = firstArray(first(row, [
    "naringsgrenOrganisation",
    "näringsgrenOrganisation",
    "naringsgrenar",
    "näringsgrenar",
    "sniKoder",
    "sniCodes",
  ]));
  for (const value of values) {
    const item = object(value);
    const code = item
      ? text(first(item, ["kod", "code", "sniKod", "snikod", "näringsgrenKod", "naringsgrenKod"]))
      : text(value);
    if (!code) continue;
    return {
      code: normalizeSniCode(code),
      label: item ? text(first(item, ["text", "namn", "name", "beskrivning", "description"])) : "",
    };
  }
  return { code: "", label: "" };
}

function addressFromRecord(row: AnyRecord) {
  const address = object(first(row, ["organisationspostadress", "postadress", "address", "postalAddress"])) ?? row;
  const street1 = text(first(address, ["addressLine1", "utdelningsadress1", "gatuadress", "street", "streetAddress", "adressrad1"]));
  const street2 = text(first(address, ["utdelningsadress2", "adressrad2", "addressLine2"]));
  return {
    addressLine1: [street1, street2].filter(Boolean).join(", "),
    postalCode: text(first(address, ["postalCode", "postnummer", "zip", "zipCode"])),
    city: text(first(address, ["city", "postort", "ort", "postalTown"])),
    municipality: text(first(row, ["municipality", "kommun", "kommunnamn"])),
    region: text(first(row, ["region", "lan", "län", "lansnamn", "länsnamn"])),
  };
}

function taxStatus(row: AnyRecord, keys: string[]) {
  const value = first(row, keys);
  if (value === undefined || value === null) return "";
  return bool(value) ? "Registrerad" : text(value);
}

function normalizeSourceRecord(row: AnyRecord, provider: string): NormalizedDirectoryCandidate | null {
  const organizationNumber = text(first(row, [
    "organizationNumber",
    "organisationNumber",
    "organisationsnummer",
    "identitetsbeteckning",
    "identity",
    "orgNumber",
  ])).replace(/\s+/g, "");
  if (!organizationNumber) return null;

  const legalFormValue = first(row, ["legalForm", "juridiskForm", "juridisk_form", "organisationsform", "organizationForm"]);
  const legalForm = text(legalFormValue);
  const legalName = nameFromRecord(row);
  const sni = sniFromRecord(row);
  const address = addressFromRecord(row);
  const activeValue = first(row, ["isActive", "verksamOrganisation", "verksam_organisation", "active", "statusAktiv"]);
  const deregistered = first(row, ["avregistreradOrganisation", "avregistrerad", "deregisteredAt"]);
  const isActive = activeValue !== undefined ? bool(activeValue) : !text(deregistered);
  const sourceUpdatedRaw = text(first(row, ["sourceUpdatedAt", "updatedAt", "andradTidpunkt", "ändradTidpunkt", "lastUpdated"]));
  const parsedUpdated = sourceUpdatedRaw ? new Date(sourceUpdatedRaw) : null;

  return {
    countryCode: (text(first(row, ["countryCode", "registreringsland", "country"])) || "SE").toUpperCase().slice(0, 2),
    organizationNumber,
    organizationKind: classifyOrganizationKind(legalForm),
    legalName,
    displayName: text(first(row, ["displayName", "marketingName"])) || legalName,
    legalForm,
    organizationStatus: text(first(row, ["organizationStatus", "status", "registreringsstatus", "registrationStatus"])),
    isActive,
    fTaxStatus: taxStatus(row, ["fTaxStatus", "fSkatt", "f_skatt", "fskatt"]),
    vatStatus: taxStatus(row, ["vatStatus", "momsregistrerad", "momsreg", "vatRegistered"]),
    employerStatus: taxStatus(row, ["employerStatus", "arbetsgivarregistrerad", "arbetsgivarreg", "employerRegistered"]),
    primarySniCode: sni.code,
    primarySniLabel: sni.label,
    activityDescription: text(first(row, ["activityDescription", "verksamhetsbeskrivning", "businessDescription", "description"])),
    ...address,
    officialSource: provider,
    sourceRecordId: text(first(row, ["sourceRecordId", "id", "recordId"])) || organizationNumber.replace(/\D/g, ""),
    sourceUpdatedAt: parsedUpdated && Number.isFinite(parsedUpdated.getTime()) ? parsedUpdated : null,
  };
}

function sourceItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  const row = object(payload);
  if (!row) return [];
  for (const key of ["items", "data", "results", "organisations", "organisationer", "foretag", "företag", "records"]) {
    if (Array.isArray(row[key])) return row[key] as unknown[];
  }
  return [row];
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
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
    },
    body: "grant_type=client_credentials",
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

export async function fetchOfficialCompanyDirectoryBatch(input: { cursor?: string; limit?: number } = {}): Promise<CompanyDirectorySourceBatch> {
  const sourceUrl = process.env.COMPANY_DIRECTORY_SOURCE_URL?.trim();
  if (!sourceUrl) throw new Error("COMPANY_DIRECTORY_SOURCE_URL is not configured");

  const provider = process.env.COMPANY_DIRECTORY_PROVIDER?.trim() || "bolagsverket_vardefulla_datamangder";
  const limit = Math.max(1, Math.min(100, input.limit ?? Number(process.env.COMPANY_DIRECTORY_BATCH_SIZE || 20)));
  const token = await oauthAccessToken();
  const response = await fetch(withCursor(sourceUrl, input.cursor ?? "", limit), {
    headers: {
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
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
