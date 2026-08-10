import "server-only";

import { getPlatformAdmin } from "@/lib/platform-admin";
import {
  BOLAGSVERKET_VDM_TEST_ORGANIZATION_NUMBERS,
  isBolagsverketVdmTestOrganizationNumber,
} from "@/lib/company-directory-bolagsverket-testdata";
import {
  assessDirectoryCandidate,
  type NormalizedDirectoryCandidate,
} from "@/lib/company-directory-policy";
import {
  fetchOfficialCompanyDirectoryBatch,
  verifyOfficialCompanyCandidate,
} from "@/lib/company-directory-source";

const DEFAULT_PROVIDER = "bolagsverket_vardefulla_datamangder";

type DiscoveryMode = "seed" | "feed";

async function requireSuperAdmin() {
  const admin = await getPlatformAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Super admin access required");
}

function discoveryMode(): DiscoveryMode {
  return process.env.COMPANY_DIRECTORY_DISCOVERY_MODE?.trim().toLowerCase() === "feed" ? "feed" : "seed";
}

function seedOrganizationNumbers() {
  const values = process.env.COMPANY_DIRECTORY_SEED_ORGANIZATION_NUMBERS?.split(/[\s,;]+/) ?? [];
  return [...new Set(values.map((value) => value.replace(/\D/g, "")).filter((value) => value.length === 10))];
}

function normalizeRequestedOrganizationNumbers(values: string[]) {
  return [...new Set(values.map((value) => value.replace(/\D/g, "")).filter(Boolean))];
}

function detailRequestConfigured() {
  return Boolean(process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE?.trim());
}

function seedCandidate(organizationNumber: string): NormalizedDirectoryCandidate {
  return {
    countryCode: "SE",
    organizationNumber,
    organizationKind: "unknown",
    legalName: "",
    displayName: "",
    legalForm: "",
    organizationStatus: "",
    isActive: false,
    fTaxStatus: "",
    vatStatus: "",
    employerStatus: "",
    primarySniCode: "",
    primarySniLabel: "",
    activityDescription: "",
    addressLine1: "",
    postalCode: "",
    city: "",
    municipality: "",
    region: "",
    officialSource: `${DEFAULT_PROVIDER}:seed`,
    sourceRecordId: organizationNumber,
    sourceUpdatedAt: null,
  };
}

export function getCompanyDirectorySourceReadiness() {
  const mode = discoveryMode();
  const seeds = seedOrganizationNumbers();
  return {
    mode,
    syncEnabled: process.env.COMPANY_DIRECTORY_SYNC_ENABLED === "true",
    sourceConfigured: mode === "seed"
      ? seeds.length > 0
      : Boolean(process.env.COMPANY_DIRECTORY_SOURCE_URL?.trim()),
    seedCount: seeds.length,
    officialTestCount: BOLAGSVERKET_VDM_TEST_ORGANIZATION_NUMBERS.length,
    detailConfigured: detailRequestConfigured(),
    oauthConfigured: Boolean(
      process.env.COMPANY_DIRECTORY_TOKEN_URL?.trim()
      && process.env.BOLAGSVERKET_CLIENT_ID?.trim()
      && process.env.BOLAGSVERKET_CLIENT_SECRET?.trim(),
    ),
  };
}

export async function previewCompanyDirectorySource(limit = 5, requestedOrganizationNumbers: string[] = []) {
  await requireSuperAdmin();
  const readiness = getCompanyDirectorySourceReadiness();
  const requested = normalizeRequestedOrganizationNumbers(requestedOrganizationNumbers);

  if (readiness.mode === "seed" && requested.length) {
    const invalid = requested.filter((organizationNumber) => !isBolagsverketVdmTestOrganizationNumber(organizationNumber));
    if (invalid.length) {
      throw new Error("Endast officiellt dokumenterade Bolagsverket TEST-identiteter får användas i Källtest");
    }
  }

  if (!readiness.sourceConfigured && !(readiness.mode === "seed" && requested.length)) {
    throw new Error(readiness.mode === "seed"
      ? "Pilot seed organisation numbers are not configured"
      : "Official discovery feed is not configured");
  }
  if (readiness.mode === "seed" && !readiness.detailConfigured) {
    throw new Error("Official detail endpoint is required for seed mode; the documented /organisationer request body is built in");
  }
  if (readiness.mode === "seed" && !readiness.oauthConfigured) {
    throw new Error("Official test OAuth credentials are required for seed mode");
  }

  const safeLimit = Math.max(1, Math.min(5, limit));
  const selectedSeedNumbers = requested.length ? requested : seedOrganizationNumbers();
  const batch = readiness.mode === "seed"
    ? {
        items: selectedSeedNumbers.slice(0, safeLimit).map(seedCandidate),
        nextCursor: null,
        provider: requested.length ? `${DEFAULT_PROVIDER}:testdata` : `${DEFAULT_PROVIDER}:seed`,
      }
    : await fetchOfficialCompanyDirectoryBatch({ limit: safeLimit });
  const results = [];

  for (const discovered of batch.items.slice(0, safeLimit)) {
    try {
      const verified = await verifyOfficialCompanyCandidate(discovered);
      const assessment = assessDirectoryCandidate(verified);
      results.push({
        ok: true as const,
        candidate: verified,
        assessment,
      });
    } catch (error) {
      results.push({
        ok: false as const,
        organizationNumber: discovered.organizationNumber,
        error: error instanceof Error ? error.message : "Unknown verification error",
      });
    }
  }

  return {
    provider: batch.provider,
    nextCursor: batch.nextCursor,
    count: results.length,
    results,
  };
}
