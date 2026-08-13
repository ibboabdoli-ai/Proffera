type AnyRecord = Record<string, unknown>;

export type BolagsverketApiError = {
  path: string;
  type: string;
  description: string;
};

const MAX_FORMATTED_ERRORS = 5;
const MAX_ERROR_PATH_LENGTH = 160;
const MAX_ERROR_TYPE_LENGTH = 80;
const MAX_ERROR_DESCRIPTION_LENGTH = 240;
const MAX_ERROR_SUMMARY_LENGTH = 1600;

function object(value: unknown): AnyRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : null;
}

function text(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).trim();
  }
  return "";
}

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  if (maxLength <= 1) return value.slice(0, maxLength);
  return `${value.slice(0, maxLength - 1)}…`;
}

function errorFromValue(value: unknown, path: string): BolagsverketApiError | null {
  const row = object(value);
  if (!row) return null;

  const type = text(row.typ ?? row.type ?? row.kod ?? row.code);
  const description = text(row.felBeskrivning ?? row.description ?? row.beskrivning ?? row.message);
  if (!type && !description) return null;

  return {
    path,
    type: type || "UNKNOWN",
    description,
  };
}

/**
 * Bolagsverket can return HTTP 200 while one or more datasets contain a `fel` object.
 * Treat every explicit `fel` as an incomplete response so stale verified facts are not
 * overwritten with null/empty values from a partial upstream response.
 */
export function collectBolagsverketApiErrors(value: unknown): BolagsverketApiError[] {
  const errors: BolagsverketApiError[] = [];
  const visited = new Set<object>();

  function walk(current: unknown, path: string) {
    if (!current || typeof current !== "object") return;
    if (visited.has(current as object)) return;
    visited.add(current as object);

    if (Array.isArray(current)) {
      current.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }

    const row = current as AnyRecord;
    if (Object.prototype.hasOwnProperty.call(row, "fel") && row.fel !== null && row.fel !== undefined) {
      const values = Array.isArray(row.fel) ? row.fel : [row.fel];
      values.forEach((item, index) => {
        const suffix = values.length > 1 ? `[${index}]` : "";
        const parsed = errorFromValue(item, `${path}.fel${suffix}`);
        if (parsed) errors.push(parsed);
      });
    }

    for (const [key, child] of Object.entries(row)) {
      if (key === "fel") continue;
      walk(child, path ? `${path}.${key}` : key);
    }
  }

  walk(value, "organisation");
  return errors;
}

export function formatBolagsverketApiErrors(errors: BolagsverketApiError[]) {
  const summary = errors
    .slice(0, MAX_FORMATTED_ERRORS)
    .map((error) => {
      const path = truncate(error.path, MAX_ERROR_PATH_LENGTH);
      const type = truncate(error.type, MAX_ERROR_TYPE_LENGTH);
      const description = truncate(error.description, MAX_ERROR_DESCRIPTION_LENGTH);
      return `${path}: ${type}${description ? ` (${description})` : ""}`;
    })
    .join("; ");

  return truncate(summary, MAX_ERROR_SUMMARY_LENGTH);
}

function normalizeIdentity(value: unknown) {
  return text(value).replace(/\D/g, "");
}

function organizationRecords(payload: unknown): AnyRecord[] {
  if (Array.isArray(payload)) {
    return payload.map((value) => object(value)).filter((value): value is AnyRecord => Boolean(value));
  }

  const root = object(payload);
  if (!root) return [];

  for (const key of ["organisationer", "organisations", "organizations", "items", "results"]) {
    const value = root[key];
    if (Array.isArray(value)) {
      const rows = value.map((item) => object(item)).filter((item): item is AnyRecord => Boolean(item));
      if (rows.length > 0) return rows;
    }
    const row = object(value);
    if (row) return [row];
  }

  for (const key of ["organisation", "organization", "data", "result", "foretag", "företag"]) {
    const value = root[key];
    if (Array.isArray(value)) {
      const rows = value.map((item) => object(item)).filter((item): item is AnyRecord => Boolean(item));
      if (rows.length > 0) return rows;
    }
    const row = object(value);
    if (row) return [row];
  }

  return [root];
}

/**
 * Resolve one exact organisation response without silently selecting the first item.
 * The documented identity type is optional because an official Aktiebolag example omits it.
 */
export function resolveBolagsverketOrganizationRecord(
  payload: unknown,
  requestedOrganizationNumber: string,
): AnyRecord {
  const requested = normalizeIdentity(requestedOrganizationNumber);
  if (!/^\d{10}$/.test(requested)) {
    throw new Error("Official facts lookup requires a 10-digit organization number");
  }

  const candidates = organizationRecords(payload);
  if (candidates.length === 0) {
    throw new Error("Official facts lookup returned no organization record");
  }

  const matches = candidates.filter((row) => {
    const identity = object(row.organisationsidentitet);
    return normalizeIdentity(identity?.identitetsbeteckning) === requested;
  });

  if (matches.length === 0) {
    throw new Error("Official facts lookup returned no matching organization identity");
  }
  if (matches.length > 1) {
    throw new Error("Official facts lookup returned multiple matching organization records");
  }

  const row = matches[0];
  const identity = object(row.organisationsidentitet);
  const identityTypeValue = identity?.typ;
  const identityType = text(object(identityTypeValue)?.kod ?? identityTypeValue).toUpperCase();
  if (identityType && !["ORGNR", "ORGANISATIONSNUMMER"].includes(identityType)) {
    throw new Error("Official facts lookup returned an unsupported identity type");
  }

  return row;
}
