import "server-only";

import {
  buildDirectoryAddressSearchText,
  cleanDirectoryStreetAddress,
  diagnoseExactSwerefAddressDetail,
  selectDirectoryAddressReferenceCandidates,
  type DirectoryGeocodingNoMatchReason,
  type LantmaterietAddressReference,
} from "@/lib/company-directory-geocoding";

const DEFAULT_LANTMATERIET_DETAIL_BASE_URL =
  "https://api.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2";
const DEFAULT_LANTMATERIET_LOOKUP_BASE_URL =
  "https://api.lantmateriet.se/distribution/produkter/uppslag/adress/v3";
export const CUSTOMER_ADDRESS_VERIFICATION_SOURCE = "lantmateriet_belagenhetsadress_v4_2" as const;
const MAX_DETAIL_CANDIDATES = 5;
const VERIFICATION_BUDGET_MS = 10_000;
const REQUEST_TIMEOUT_MS = 4_000;
const MIN_REQUEST_BUDGET_MS = 250;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type VerificationConfig = {
  username: string;
  password: string;
  lookupBaseUrl: string;
  detailBaseUrl: string;
  configured: boolean;
};

export type VerifiedCustomerAddress = {
  status: "matched";
  source: typeof CUSTOMER_ADDRESS_VERIFICATION_SOURCE;
  referenceId: string;
  easting: number;
  northing: number;
};

export type CustomerAddressVerificationResult =
  | VerifiedCustomerAddress
  | { status: "no_match"; reason: DirectoryGeocodingNoMatchReason }
  | { status: "unavailable"; reason: "not_configured" | "timeout" | "upstream_error" };

class VerificationTimeoutError extends Error {
  constructor() {
    super("Customer address verification deadline reached");
    this.name = "VerificationTimeoutError";
  }
}

export function isValidCustomerAddressReferenceId(value: unknown): value is string {
  return typeof value === "string" && value === value.trim() && UUID_PATTERN.test(value);
}

function normalizeApprovedBaseUrl(input: {
  rawUrl: string;
  fallbackUrl: string;
  expectedPath: string;
}) {
  let parsedUrl: URL | null = null;
  try {
    parsedUrl = new URL(input.rawUrl);
  } catch {
    parsedUrl = null;
  }

  const allowedProtocol = parsedUrl?.protocol === "https:";
  const allowedHost = parsedUrl?.hostname === "api.lantmateriet.se"
    || parsedUrl?.hostname === "api-ver.lantmateriet.se";
  const allowedPath = parsedUrl?.pathname === input.expectedPath
    || parsedUrl?.pathname === `${input.expectedPath}/`;
  const accepted = Boolean(parsedUrl) && allowedProtocol && allowedHost && allowedPath;
  const normalizedUrl = parsedUrl
    ? `${parsedUrl.origin}${parsedUrl.pathname}`.replace(/\/$/, "")
    : input.fallbackUrl;

  return {
    accepted,
    baseUrl: accepted ? normalizedUrl : input.fallbackUrl,
  };
}

function getVerificationConfig(): VerificationConfig {
  const username = process.env.LANTMATERIET_ADDRESS_API_USERNAME?.trim() ?? "";
  const password = process.env.LANTMATERIET_ADDRESS_API_PASSWORD?.trim() ?? "";
  const rawDetailBase = process.env.LANTMATERIET_ADDRESS_API_BASE_URL?.trim()
    || DEFAULT_LANTMATERIET_DETAIL_BASE_URL;
  const rawLookupBase = process.env.LANTMATERIET_ADDRESS_LOOKUP_API_BASE_URL?.trim()
    || DEFAULT_LANTMATERIET_LOOKUP_BASE_URL;

  const detail = normalizeApprovedBaseUrl({
    rawUrl: rawDetailBase,
    fallbackUrl: DEFAULT_LANTMATERIET_DETAIL_BASE_URL,
    expectedPath: "/distribution/produkter/belagenhetsadress/v4.2",
  });
  const lookup = normalizeApprovedBaseUrl({
    rawUrl: rawLookupBase,
    fallbackUrl: DEFAULT_LANTMATERIET_LOOKUP_BASE_URL,
    expectedPath: "/distribution/produkter/uppslag/adress/v3",
  });

  return {
    username,
    password,
    lookupBaseUrl: lookup.baseUrl,
    detailBaseUrl: detail.baseUrl,
    configured: Boolean(username) && Boolean(password) && lookup.accepted && detail.accepted,
  };
}

function authorizationHeader(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`, "utf8").toString("base64")}`;
}

function requestTimeout(deadline: number) {
  const remaining = deadline - Date.now();
  if (remaining < MIN_REQUEST_BUDGET_MS) throw new VerificationTimeoutError();
  return Math.max(MIN_REQUEST_BUDGET_MS, Math.min(REQUEST_TIMEOUT_MS, remaining));
}

function isTimeoutError(error: unknown) {
  if (error instanceof VerificationTimeoutError) return true;
  if (!error || typeof error !== "object") return false;
  const name = String((error as { name?: unknown }).name ?? "");
  return name === "TimeoutError" || name === "AbortError";
}

function safeErrorSummary(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: "UnknownError", message: String(error) };
}

async function fetchJson(url: URL, config: VerificationConfig, deadline: number) {
  const timeoutMs = requestTimeout(deadline);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: authorizationHeader(config.username, config.password),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Lantmäteriet request failed (${response.status})`);
  return await response.json() as unknown;
}

export async function verifyCustomerAddress(input: {
  addressLine1: string;
  postalCode: string;
  city: string;
}): Promise<CustomerAddressVerificationResult> {
  const config = getVerificationConfig();
  if (!config.configured) return { status: "unavailable", reason: "not_configured" };

  const streetAddress = cleanDirectoryStreetAddress(input.addressLine1);
  if (!streetAddress || streetAddress.toLocaleLowerCase("sv-SE").startsWith("box ")) {
    return { status: "no_match", reason: "invalid_address" };
  }

  const deadline = Date.now() + VERIFICATION_BUDGET_MS;
  try {
    const searchUrl = new URL(`${config.lookupBaseUrl}/fritext`);
    searchUrl.searchParams.set("adress", buildDirectoryAddressSearchText(streetAddress, input.city));

    const referencePayload = await fetchJson(searchUrl, config, deadline);
    if (!Array.isArray(referencePayload)) {
      return { status: "no_match", reason: "unexpected_reference_response" };
    }
    if (referencePayload.length === 0) return { status: "no_match", reason: "no_reference" };

    const references = referencePayload as LantmaterietAddressReference[];
    if (!references.some((reference) => isValidCustomerAddressReferenceId(reference.objektidentitet))) {
      return { status: "no_match", reason: "invalid_reference" };
    }
    const candidates = selectDirectoryAddressReferenceCandidates(references, input.postalCode, input.city);
    if (candidates.length === 0) return { status: "no_match", reason: "reference_postal_mismatch" };
    if (candidates.length > MAX_DETAIL_CANDIDATES) return { status: "no_match", reason: "too_many_candidates" };

    let resolved: VerifiedCustomerAddress | null = null;
    const detailReasons = new Set<DirectoryGeocodingNoMatchReason>();
    for (const candidate of candidates) {
      const referenceId = candidate.objektidentitet;
      if (!isValidCustomerAddressReferenceId(referenceId)) {
        return { status: "no_match", reason: "invalid_reference" };
      }
      if (Date.now() >= deadline) throw new VerificationTimeoutError();

      const detailUrl = new URL(`${config.detailBaseUrl}/${encodeURIComponent(referenceId)}`);
      detailUrl.searchParams.set("includeData", "basinformation");
      detailUrl.searchParams.set("srid", "3006");
      const detailPayload = await fetchJson(detailUrl, config, deadline);
      const detail = diagnoseExactSwerefAddressDetail(
        detailPayload,
        input.postalCode,
        input.city,
        streetAddress,
      );
      if (!detail.point) {
        detailReasons.add(detail.reason);
        continue;
      }
      if (resolved) return { status: "no_match", reason: "ambiguous_exact_match" };
      resolved = {
        status: "matched",
        source: CUSTOMER_ADDRESS_VERIFICATION_SOURCE,
        referenceId,
        easting: detail.point.easting,
        northing: detail.point.northing,
      };
    }

    if (resolved) return resolved;
    if (detailReasons.size === 1) return { status: "no_match", reason: [...detailReasons][0] };
    return { status: "no_match", reason: "no_exact_detail_match" };
  } catch (error) {
    const reason = isTimeoutError(error) ? "timeout" as const : "upstream_error" as const;
    console.error("Lantmäteriet customer address verification failed", {
      reason,
      error: safeErrorSummary(error),
    });
    return { status: "unavailable", reason };
  }
}
