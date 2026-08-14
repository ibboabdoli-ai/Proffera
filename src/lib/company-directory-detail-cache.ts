import "server-only";

type AnyRecord = Record<string, unknown>;

type CachedDetail = {
  record: AnyRecord;
  expiresAt: number;
};

const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 50;
const verifiedDetails = new Map<string, CachedDetail>();

function normalizeOrganizationNumber(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function pruneExpired(now: number) {
  for (const [organizationNumber, cached] of verifiedDetails) {
    if (cached.expiresAt <= now) verifiedDetails.delete(organizationNumber);
  }
}

export function rememberCompleteBolagsverketOrganizationRecord(
  organizationNumber: string,
  record: AnyRecord,
) {
  const normalized = normalizeOrganizationNumber(organizationNumber);
  if (!/^\d{10}$/.test(normalized)) return;

  const now = Date.now();
  pruneExpired(now);
  if (!verifiedDetails.has(normalized) && verifiedDetails.size >= MAX_CACHE_ENTRIES) {
    const oldest = verifiedDetails.keys().next().value;
    if (oldest) verifiedDetails.delete(oldest);
  }

  verifiedDetails.set(normalized, {
    record,
    expiresAt: now + CACHE_TTL_MS,
  });
}

export function takeCompleteBolagsverketOrganizationRecord(
  organizationNumber: string,
): AnyRecord | null {
  const normalized = normalizeOrganizationNumber(organizationNumber);
  if (!/^\d{10}$/.test(normalized)) return null;

  const cached = verifiedDetails.get(normalized);
  if (!cached) return null;
  verifiedDetails.delete(normalized);

  if (cached.expiresAt <= Date.now()) return null;
  return cached.record;
}
