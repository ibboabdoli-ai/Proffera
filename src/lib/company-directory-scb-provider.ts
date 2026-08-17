import "server-only";

const DEFAULT_SCB_COMPANY_REGISTRY_BASE_URL = "https://api.scb.se/foretagsregistret/v1";
const SCB_SOURCE = "scb_foretagsregistret" as const;

type UnknownRecord = Record<string, unknown>;

export type ScbCompanyRegistryAddress = {
  careOf: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
};

export type ScbCompanyRegistryWorkplace = {
  cfarNumber: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  visitingAddress: ScbCompanyRegistryAddress;
  postalAddress: ScbCompanyRegistryAddress;
  municipality: string | null;
  sniCodes: string[];
};

export type ScbCompanyRegistryEnrichment = {
  organizationNumber: string;
  legalName: string | null;
  phone: string | null;
  email: string | null;
  postalAddress: ScbCompanyRegistryAddress;
  municipality: string | null;
  sniCodes: string[];
  workplaces: ScbCompanyRegistryWorkplace[];
  source: typeof SCB_SOURCE;
};

export type ScbCompanyRegistryTransport = {
  fetchCompany: (organizationNumber: string) => Promise<unknown>;
  fetchWorkplaces: (organizationNumber: string) => Promise<unknown>;
};

export type ScbCompanyRegistryFetchResult =
  | { status: "disabled"; data: null }
  | { status: "awaiting_access"; data: null }
  | { status: "ok"; data: ScbCompanyRegistryEnrichment };

export type ScbCompanyRegistryStatus = {
  enabled: boolean;
  baseUrl: string;
  accessReady: boolean;
};

function stringValue(value: unknown) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function normalizedKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("sv-SE")
    .replace(/[^a-z0-9]/g, "");
}

function valueFor(record: UnknownRecord, candidates: string[]) {
  const wanted = new Set(candidates.map(normalizedKey));
  for (const [key, value] of Object.entries(record)) {
    if (wanted.has(normalizedKey(key))) return value;
  }
  return undefined;
}

function textFor(record: UnknownRecord, candidates: string[]) {
  return stringValue(valueFor(record, candidates));
}

function normalizeOrganizationNumber(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("16")) return digits.slice(2);
  if (digits.length === 10) return digits;
  return "";
}

function organizationNumberFor(record: UnknownRecord) {
  return normalizeOrganizationNumber(valueFor(record, [
    "OrgNr",
    "Organisationsnummer",
    "OrganisationNr",
    "PeOrgNr",
  ]));
}

function recordsFromPayload(payload: unknown): UnknownRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter((item): item is UnknownRecord => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  }
  if (!payload || typeof payload !== "object") return [];

  const record = payload as UnknownRecord;
  const collectionKeys = [
    "data",
    "rows",
    "items",
    "records",
    "result",
    "results",
    "foretag",
    "företag",
    "arbetsstallen",
    "arbetsställen",
  ];
  for (const key of collectionKeys) {
    const nested = valueFor(record, [key]);
    if (Array.isArray(nested)) return recordsFromPayload(nested);
    if (nested && typeof nested === "object") {
      const nestedRecords = recordsFromPayload(nested);
      if (nestedRecords.length) return nestedRecords;
    }
  }
  return [record];
}

function postalCode(value: unknown) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 5) return stringValue(value);
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

function addressFromRecord(record: UnknownRecord, kind: "postal" | "visiting"): ScbCompanyRegistryAddress {
  if (kind === "visiting") {
    return {
      careOf: null,
      addressLine: textFor(record, ["BesöksAdress", "BesoksAdress", "Belägenhetsadress", "Belagenhetsadress"]),
      postalCode: postalCode(valueFor(record, ["BesöksPostNr", "BesoksPostNr", "BelägenhetsPostNr", "BelagenhetsPostNr"])),
      city: textFor(record, ["BesöksPostOrt", "BesoksPostOrt", "BelägenhetsOrt", "BelagenhetsOrt"]),
    };
  }
  return {
    careOf: textFor(record, ["COadress", "C/O adress", "CareOf"]),
    addressLine: textFor(record, ["Postadress", "PostAdress"]),
    postalCode: postalCode(valueFor(record, ["PostNr", "Postnummer"])),
    city: textFor(record, ["PostOrt", "Postort"]),
  };
}

function normalizeSniCode(value: unknown) {
  const text = stringValue(value);
  if (!text) return null;
  const compact = text.replace(/\s+/g, "");
  const match = compact.match(/\d{2}(?:\.?\d{2,3})?/);
  if (!match) return null;
  const digits = match[0].replace(/\D/g, "");
  if (digits.length === 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return match[0];
}

function sniCodesFromRecord(record: UnknownRecord) {
  const values: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    const normalized = normalizedKey(key);
    const looksLikeSni = normalized.includes("sni")
      || (normalized.includes("bransch") && normalized.includes("kod"));
    if (!looksLikeSni) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        const code = normalizeSniCode(item);
        if (code) values.push(code);
      }
      continue;
    }
    const code = normalizeSniCode(value);
    if (code) values.push(code);
  }
  return [...new Set(values)];
}

function ensureExpectedOrganizationNumber(record: UnknownRecord, expected: string) {
  const actual = organizationNumberFor(record);
  if (!actual || actual !== expected) {
    throw new Error("SCB company registry response organization number mismatch");
  }
}

export function normalizeScbCompanyRegistryPayload(
  companyPayload: unknown,
  workplacePayload: unknown,
  expectedOrganizationNumber: string,
): ScbCompanyRegistryEnrichment {
  const expected = normalizeOrganizationNumber(expectedOrganizationNumber);
  if (!expected) throw new Error("Invalid organization number for SCB company registry lookup");

  const companies = recordsFromPayload(companyPayload);
  const matchingCompanies = companies.filter((record) => organizationNumberFor(record) === expected);
  if (matchingCompanies.length !== 1) {
    throw new Error("SCB company registry response must contain exactly one matching company");
  }
  const company = matchingCompanies[0];
  ensureExpectedOrganizationNumber(company, expected);

  const workplaces = recordsFromPayload(workplacePayload)
    .filter((record) => organizationNumberFor(record) === expected)
    .map((record): ScbCompanyRegistryWorkplace => ({
      cfarNumber: textFor(record, ["CfarNr", "CFAR-nummer", "CFARnummer"]),
      name: textFor(record, ["Benämning", "Benamning", "Arbetsställenamn", "Arbetsstallenamn"]),
      phone: textFor(record, ["Telefon", "Telefonnummer"]),
      email: textFor(record, ["E-post", "Epost", "Email"]),
      visitingAddress: addressFromRecord(record, "visiting"),
      postalAddress: addressFromRecord(record, "postal"),
      municipality: textFor(record, ["Kommun", "Kommunnamn"]),
      sniCodes: sniCodesFromRecord(record),
    }));

  return {
    organizationNumber: expected,
    legalName: textFor(company, ["Företagsnamn", "Foretagsnamn", "FöretagsNamn", "Firma"]),
    phone: textFor(company, ["Telefon", "Telefonnummer"]),
    email: textFor(company, ["E-post", "Epost", "Email"]),
    postalAddress: addressFromRecord(company, "postal"),
    municipality: textFor(company, ["Kommun", "Säteskommun", "Sateskommun", "Kommunnamn"]),
    sniCodes: sniCodesFromRecord(company),
    workplaces,
    source: SCB_SOURCE,
  };
}

function scbCompanyRegistryEnabled() {
  return process.env.SCB_COMPANY_REGISTRY_ENABLED?.trim().toLowerCase() === "true";
}

function safeBaseUrl() {
  const raw = process.env.SCB_COMPANY_REGISTRY_BASE_URL?.trim() || DEFAULT_SCB_COMPANY_REGISTRY_BASE_URL;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:"
      || url.hostname !== "api.scb.se"
      || Boolean(url.username)
      || Boolean(url.password)
    ) {
      return DEFAULT_SCB_COMPANY_REGISTRY_BASE_URL;
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_SCB_COMPANY_REGISTRY_BASE_URL;
  }
}

export function getScbCompanyRegistryStatus(transport?: ScbCompanyRegistryTransport): ScbCompanyRegistryStatus {
  const enabled = scbCompanyRegistryEnabled();
  return {
    enabled,
    baseUrl: safeBaseUrl(),
    accessReady: enabled && Boolean(transport),
  };
}

export async function fetchScbCompanyRegistryEnrichment(
  organizationNumber: string,
  transport?: ScbCompanyRegistryTransport,
): Promise<ScbCompanyRegistryFetchResult> {
  if (!scbCompanyRegistryEnabled()) return { status: "disabled", data: null };
  if (!transport) return { status: "awaiting_access", data: null };

  const expected = normalizeOrganizationNumber(organizationNumber);
  if (!expected) throw new Error("Invalid organization number for SCB company registry lookup");

  const [companyPayload, workplacePayload] = await Promise.all([
    transport.fetchCompany(expected),
    transport.fetchWorkplaces(expected),
  ]);

  return {
    status: "ok",
    data: normalizeScbCompanyRegistryPayload(companyPayload, workplacePayload, expected),
  };
}