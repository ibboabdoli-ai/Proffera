import "server-only";

import { getPlatformAdmin } from "@/lib/platform-admin";
import { assessDirectoryCandidate } from "@/lib/company-directory-policy";
import {
  fetchOfficialCompanyDirectoryBatch,
  verifyOfficialCompanyCandidate,
} from "@/lib/company-directory-source";

async function requireSuperAdmin() {
  const admin = await getPlatformAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Super admin access required");
}

export function getCompanyDirectorySourceReadiness() {
  return {
    syncEnabled: process.env.COMPANY_DIRECTORY_SYNC_ENABLED === "true",
    sourceConfigured: Boolean(process.env.COMPANY_DIRECTORY_SOURCE_URL?.trim()),
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
  if (!readiness.sourceConfigured) throw new Error("Official discovery source is not configured");

  const safeLimit = Math.max(1, Math.min(5, limit));
  const batch = await fetchOfficialCompanyDirectoryBatch({ limit: safeLimit });
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
