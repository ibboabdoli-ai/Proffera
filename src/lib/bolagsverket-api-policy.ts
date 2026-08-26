import "server-only";

const VARDEFULLA_DATA_MIN_INTERVAL_MS = 1_050;
const PAID_COMPANY_INFO_MIN_INTERVAL_MS = 55;

let requestQueue: Promise<void> = Promise.resolve();
let lastRequestStartedAt = 0;

function normalizedProvider(provider: unknown) {
  return String(provider ?? "").trim().toLowerCase();
}

/**
 * Return a conservative process-local spacing for Bolagsverket data requests.
 * Värdefulla datamängder is kept below 60 requests/minute; the paid company
 * information API is kept below 20 requests/second. Unknown providers use the
 * stricter Värdefulla datamängder spacing.
 */
export function bolagsverketMinimumIntervalMs(provider: unknown) {
  const value = normalizedProvider(provider);
  if (value.includes("foretagsinformation") && !value.includes("vardefulla")) {
    return PAID_COMPANY_INFO_MIN_INTERVAL_MS;
  }
  return VARDEFULLA_DATA_MIN_INTERVAL_MS;
}

/** Validate that an upstream Bolagsverket URL is HTTPS and contains no credentials. */
export function requireBolagsverketHttpsUrl(value: string, label: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
  if (url.protocol !== "https:") throw new Error(`${label} must use HTTPS`);
  if (url.username || url.password) throw new Error(`${label} must not embed credentials`);
  return url;
}

/**
 * Serialize Bolagsverket data requests inside one runtime instance. This is a
 * safety floor, not a distributed global limiter; schedulers and worker
 * concurrency must remain bounded as documented in the repository policy.
 */
export async function waitForBolagsverketRequestSlot(provider: unknown) {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return;

  const previous = requestQueue;
  let release: (() => void) | undefined;
  requestQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;

  try {
    const interval = bolagsverketMinimumIntervalMs(provider);
    const waitMs = Math.max(0, lastRequestStartedAt + interval - Date.now());
    if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastRequestStartedAt = Date.now();
  } finally {
    release?.();
  }
}

/**
 * Automated Company Directory detail lookups intentionally stay on Swedish
 * juridical-person identities and never use a personnummer/sole-trader path.
 * Swedish organisationsnummer have ten digits and a third digit of at least 2,
 * which keeps personnummer-shaped identifiers outside this adapter boundary.
 */
export function canQueryBolagsverketCompanyDetail(candidate: {
  countryCode: unknown;
  organizationNumber: unknown;
  organizationKind: unknown;
}) {
  const organizationNumber = String(candidate.organizationNumber ?? "").replace(/\D/g, "");
  const hasOrganizationNumberShape = /^\d{10}$/.test(organizationNumber)
    && Number(organizationNumber[2]) >= 2;
  return String(candidate.countryCode ?? "").trim().toUpperCase() === "SE"
    && candidate.organizationKind === "juridical_person"
    && hasOrganizationNumberShape;
}
