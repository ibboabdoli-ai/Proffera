type AnyRecord = Record<string, unknown>;

export type BolagsverketApiError = {
  path: string;
  type: string;
  description: string;
};

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
  return errors
    .slice(0, 5)
    .map((error) => `${error.path}: ${error.type}${error.description ? ` (${error.description})` : ""}`)
    .join("; ");
}
