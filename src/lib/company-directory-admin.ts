import "server-only";

import { getPlatformAdmin } from "@/lib/platform-admin";
import { getSql } from "@/lib/db/server";

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function isMissingDirectorySchema(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const row = error as { code?: unknown; message?: unknown };
  return String(row.code ?? "") === "42P01"
    || String(row.message ?? "").includes("company_directory_");
}

async function requireSuperAdmin() {
  const admin = await getPlatformAdmin();
  if (!admin || admin.role !== "super_admin") throw new Error("Super admin access required");
  return admin;
}

export type CompanyDirectoryAdminSnapshot = {
  schemaReady: boolean;
  config: {
    syncEnabled: boolean;
    autoPublishEnabled: boolean;
    sourceConfigured: boolean;
    detailConfigured: boolean;
    oauthConfigured: boolean;
    provider: string;
    batchSize: number;
    maxPages: number;
    pilotLocations: string[];
  };
  counts: Record<string, number>;
  pendingClaims: number;
  latestRuns: Array<{
    id: string;
    provider: string;
    status: string;
    scanned: number;
    upserted: number;
    published: number;
    blocked: number;
    errors: number;
    startedAt: string;
    completedAt: string;
    errorSummary: string;
  }>;
  profiles: Array<{
    id: string;
    slug: string;
    companyName: string;
    legalForm: string;
    city: string;
    municipality: string;
    categorySlug: string;
    sniCode: string;
    sniLabel: string;
    status: string;
    qualityScore: number;
    privacyBlocked: boolean;
    active: boolean;
    source: string;
    lastSyncedAt: string;
  }>;
};

function configSnapshot() {
  return {
    syncEnabled: process.env.COMPANY_DIRECTORY_SYNC_ENABLED === "true",
    autoPublishEnabled: process.env.COMPANY_DIRECTORY_AUTO_PUBLISH === "true",
    sourceConfigured: Boolean(process.env.COMPANY_DIRECTORY_SOURCE_URL?.trim()),
    detailConfigured: Boolean(process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE?.trim()),
    oauthConfigured: Boolean(
      process.env.COMPANY_DIRECTORY_TOKEN_URL?.trim()
      && process.env.BOLAGSVERKET_CLIENT_ID?.trim()
      && process.env.BOLAGSVERKET_CLIENT_SECRET?.trim(),
    ),
    provider: process.env.COMPANY_DIRECTORY_PROVIDER?.trim() || "bolagsverket_vardefulla_datamangder",
    batchSize: Math.max(1, Math.min(60, Number(process.env.COMPANY_DIRECTORY_BATCH_SIZE || 10))),
    maxPages: Math.max(1, Math.min(10, Number(process.env.COMPANY_DIRECTORY_MAX_PAGES_PER_RUN || 2))),
    pilotLocations: ["Stockholm", "Södertälje"],
  };
}

export async function getCompanyDirectoryAdminSnapshot(): Promise<CompanyDirectoryAdminSnapshot> {
  await requireSuperAdmin();
  const config = configSnapshot();
  const sql = getSql();
  if (!sql) {
    return {
      schemaReady: false,
      config,
      counts: {},
      pendingClaims: 0,
      latestRuns: [],
      profiles: [],
    };
  }

  try {
    const [countRows, claimRows, runRows, profileRows] = await Promise.all([
      sql`
        select publication_status, count(*)::int as count
        from company_directory_profiles
        group by publication_status
      `,
      sql`
        select count(*)::int as count
        from company_directory_claims
        where status in ('pending', 'verified')
      `,
      sql`
        select
          id::text, provider, status, scanned_count, upserted_count,
          published_count, blocked_count, error_count, error_summary,
          started_at, completed_at
        from company_directory_sync_runs
        order by started_at desc
        limit 12
      `,
      sql`
        select
          id::text, public_slug, display_name, legal_form, city, municipality,
          category_slug, primary_sni_code, primary_sni_label, publication_status,
          quality_score, privacy_blocked, is_active, official_source, last_synced_at
        from company_directory_profiles
        order by
          case publication_status
            when 'ready' then 0
            when 'review' then 1
            when 'blocked' then 2
            when 'inactive' then 3
            when 'published' then 4
            when 'claimed' then 5
            else 6
          end,
          quality_score desc,
          updated_at desc
        limit 100
      `,
    ]);

    const counts: Record<string, number> = {};
    for (const row of countRows) counts[text(row.publication_status)] = number(row.count);

    return {
      schemaReady: true,
      config,
      counts,
      pendingClaims: number(claimRows[0]?.count),
      latestRuns: runRows.map((row) => ({
        id: text(row.id),
        provider: text(row.provider),
        status: text(row.status),
        scanned: number(row.scanned_count),
        upserted: number(row.upserted_count),
        published: number(row.published_count),
        blocked: number(row.blocked_count),
        errors: number(row.error_count),
        startedAt: text(row.started_at),
        completedAt: text(row.completed_at),
        errorSummary: text(row.error_summary),
      })),
      profiles: profileRows.map((row) => ({
        id: text(row.id),
        slug: text(row.public_slug),
        companyName: text(row.display_name),
        legalForm: text(row.legal_form),
        city: text(row.city),
        municipality: text(row.municipality),
        categorySlug: text(row.category_slug),
        sniCode: text(row.primary_sni_code),
        sniLabel: text(row.primary_sni_label),
        status: text(row.publication_status),
        qualityScore: number(row.quality_score),
        privacyBlocked: Boolean(row.privacy_blocked),
        active: Boolean(row.is_active),
        source: text(row.official_source),
        lastSyncedAt: text(row.last_synced_at),
      })),
    };
  } catch (error) {
    if (isMissingDirectorySchema(error)) {
      return {
        schemaReady: false,
        config,
        counts: {},
        pendingClaims: 0,
        latestRuns: [],
        profiles: [],
      };
    }
    throw error;
  }
}
