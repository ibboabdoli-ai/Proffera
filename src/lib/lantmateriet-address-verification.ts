import "server-only";

import {
  buildDirectoryAddressSearchText,
  cleanDirectoryStreetAddress,
  diagnoseExactSwerefAddressDetail,
  selectDirectoryAddressReferenceCandidates,
  type DirectoryGeocodingNoMatchReason,
  type LantmaterietAddressReference,
} from "@/lib/company-directory-geocoding";

const DEFAULT_LANTMATERIET_BASE_URL =
  "https://api.lantmateriet.se/distribution/produkter/belagenhetsadress/v4.2";
export const CUSTOMER_ADDRESS_VERIFICATION_SOURCE = "lantmateriet_belagenhetsadress_v4_2" as const;
const MAX_DETAIL_CANDIDATES = 5;
const VERIFICATION_BUDGET_MS = 10_000;
const REQUEST_TIMEOUT_MS = 4_000;
const MIN_REQUEST_BUDGET_MS = 250;

type VerificationConfig = {
  username: string;
  password: string;
  baseUrl: string;
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

function getVerificationConfig(): VerificationConfig {
  const username = process.env.LANTMATERIET_ADDRESS_API_USERNAME?.trim() ?? "";
  const password = process.env.LANTMATERIET_ADDRESS_API_PASSWORD?.trim() ?? "";
  const rawBase = process.env.LANTMATERIET_ADDRESS_API_BASE_URL?.trim() || DEFAULT_LANTMATERIET_BASE_URL;
  let baseUrl: URL;
  try {
    baseUrl = new URL(rawBase);
  } catch {
    baseUrl = new URL(DEFAULT_LANTMATERIET_BASE_URL);
  }

  const allowedHost = baseUrl.hostname === "api.lantmateriet.se" || baseUrl.hostname === "api-ver.lantmateriet.se";
  const allowedPath = baseUrl.pathname === "/distribution/produkter/belagenhetsadress/v4.2"
    || baseUrl.pathname === "/distribution/produkter/belagenhetsadress/v4.2/";

  return {
    username,
    password,
    baseUrl: allowedHost && allowedPath ? baseUrl.toString().replace(/\/$/, "") : DEFAULT_LANTMATERIET_BASE_URL,
    configured: Boolean(username) && Boolean(password) && allowedHost && allowedPath,
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
    const searchUrl = new URL(`${config.baseUrl}/referens/fritext`);
    searchUrl.searchParams.set("adress", buildDirectoryAddressSearchText(streetAddress, input.city));
    searchUrl.searchParams.set("status", "Gällande");
    searchUrl.searchParams.set("maxHits", "20");
    searchUrl.searchParams.set("splitAdress", "true");

    const referencePayload = await fetchJson(searchUrl, config, deadline);
    if (!Array.isArray(referencePayload)) {
      return { status: "no_match", reason: "unexpected_reference_response" };
    }
    if (referencePayload.length === 0) return { status: "no_match", reason: "no_reference" };

    const references = referencePayload as LantmaterietAddressReference[];
    const candidates = selectDirectoryAddressReferenceCandidates(references, input.postalCode, input.city);
    if (candidates.length === 0) return { status: "no_match", reason: "reference_postal_mismatch" };
    if (candidates.length > MAX_DETAIL_CANDIDATES) return { status: "no_match", reason: "too_many_candidates" };

    let resolved: VerifiedCustomerAddress | null = null;
    const detailReasons = new Set<DirectoryGeocodingNoMatchReason>();
    for (const candidate of candidates) {
      const referenceId = candidate.objektidentitet;
      if (!referenceId) continue;
      if (Date.now() >= deadline) throw new VerificationTimeoutError();

      const detailUrl = new URL(`${config.baseUrl}/${encodeURIComponent(referenceId)}`);
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
    if (isTimeoutError(error)) return { status: "unavailable", reason: "timeout" };
    return { status: "unavailable", reason: "upstream_error" };
  }
}
