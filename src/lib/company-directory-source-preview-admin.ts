import "server-only";

import { getPlatformAdmin } from "@/lib/platform-admin";
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
    detailConfigured: Boolean(process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE?.trim()),
    oauthConfigured: Boolean(
      process.env.COMPANY_DIRECTORY_TOKEN_URL?.trim()
      && process.env.BOLAGSVERKET_CLIENT_ID?.trim()
      && process.env.BOLAGSVERKET_CLIENT_SECRET?.trim(),
    ),
  };
}

export async function previewCompanyDirectorySource(limit = 5) {
  await requireSuperAdmin();
  const readiness = getCompanyDirectorySourceReadiness();
  if (!readiness.sourceConfigured) {
    throw new Error(readiness.mode === "seed"
      ? "Pilot seed organisation numbers are not configured"
      : "Official discovery feed is not configured");
  }
  if (readiness.mode === "seed" && !readiness.detailConfigured) {
    throw new Error("Official detail verification endpoint is required for seed mode");
  }

  const safeLimit = Math.max(1, Math.min(5, limit));
  const batch = readiness.mode === "seed"
    ? {
        items: seedOrganizationNumbers().slice(0, safeLimit).map(seedCandidate),
        nextCursor: null,
        provider: `${DEFAULT_PROVIDER}:seed`,
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
