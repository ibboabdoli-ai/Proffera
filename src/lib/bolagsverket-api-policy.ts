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
 * Swedish juridical-person organisation numbers have a non-date identity
 * shape: the third digit is at least 2. Personnummer-shaped identities use the
 * month position there and are excluded before automatic Bolagsverket lookup.
 */
export function isBolagsverketJuridicalOrganizationNumber(value: unknown) {
  const organizationNumber = String(value ?? "").replace(/\D/g, "");
  return /^\d{10}$/.test(organizationNumber)
    && Number(organizationNumber[2]) >= 2;
}

/**
 * Automated Company Directory detail lookups stay on Swedish company-shaped
 * identities. Discovery seeds are `unknown` until the official detail response
 * supplies the legal form, so they may be verified when the identifier is not
 * person-shaped. Known sole traders remain blocked.
 */
export function canQueryBolagsverketCompanyDetail(candidate: {
  countryCode: unknown;
  organizationNumber: unknown;
  organizationKind: unknown;
}) {
  const kind = String(candidate.organizationKind ?? "").trim();
  return String(candidate.countryCode ?? "").trim().toUpperCase() === "SE"
    && isBolagsverketJuridicalOrganizationNumber(candidate.organizationNumber)
    && (kind === "juridical_person" || kind === "unknown");
}
