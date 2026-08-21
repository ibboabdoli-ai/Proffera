import "server-only";

import { getPlatformAdmin } from "@/lib/platform-admin";
import { getSql } from "@/lib/db/server";
import { assessCompanyDirectoryCategoryConfidence } from "@/lib/company-directory-category-confidence";

const PILOT_MAX_BATCH_SIZE = 10;
const PILOT_MAX_PAGES_PER_RUN = 2;
const DEFAULT_PROFILE_PAGE_SIZE = 50;
const MAX_PROFILE_PAGE_SIZE = 100;
const DIRECTORY_PROFILE_STATUSES = new Set(["all", "published", "ready", "review", "inactive"]);

const CATEGORY_SEARCH_ALIASES: Record<string, string[]> = {
  stadning: ["städning", "stadning"],
  elektriker: ["elektriker"],
  vvs: ["vvs"],
  maleri: ["måleri", "maleri"],
  snickeri: ["snickeri"],
  tradgard: ["trädgård", "tradgard"],
  flytt: ["flytt"],
  hemservice: ["hemservice"],
};

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function boundedInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function jsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeProfileStatus(value: unknown) {
  const normalized = text(value).trim().toLowerCase();
  return DIRECTORY_PROFILE_STATUSES.has(normalized) ? normalized : "all";
}

function normalizeProfileQuery(value: unknown) {
  return text(value).trim().slice(0, 120);
}

function categorySlugForQuery(value: string) {
  const normalized = value.toLocaleLowerCase("sv-SE");
  if (normalized.length < 3) return "";
  for (const [slug, aliases] of Object.entries(CATEGORY_SEARCH_ALIASES)) {
    if (aliases.some((alias) => alias.includes(normalized) || normalized.includes(alias))) return slug;
  }
  return "";
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
    profileProcessingEnabled: boolean;
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
  profilePage: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
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
    legalName: string;
    legalForm: string;
    city: string;
    municipality: string;
    categorySlug: string;
    sniCode: string;
    sniLabel: string;
    activityDescription: string;
    status: string;
    qualityScore: number;
    privacyBlocked: boolean;
    active: boolean;
    source: string;
    lastSyncedAt: string;
    categoryConfidenceScore: number;
    categoryConfidenceLevel: "high" | "review" | "low";
    categorySignals: string[];
    categoryWarnings: string[];
    officialFactsReady: boolean;
    publishSafe: boolean;
    publishSafetyReasons: string[];
  }>;
};

function configSnapshot() {
  const discoveryMode = process.env.COMPANY_DIRECTORY_DISCOVERY_MODE?.trim().toLowerCase() || "seed";

  return {
    syncEnabled: process.env.COMPANY_DIRECTORY_SYNC_ENABLED === "true",
    profileProcessingEnabled: process.env.COMPANY_DIRECTORY_PROFILE_PROCESSING_ENABLED === "true",
    autoPublishEnabled: process.env.COMPANY_DIRECTORY_AUTO_PUBLISH === "true",
    sourceConfigured: discoveryMode === "automatic"
      || Boolean(process.env.COMPANY_DIRECTORY_SOURCE_URL?.trim()),
    detailConfigured: Boolean(process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE?.trim()),
    oauthConfigured: Boolean(
      process.env.COMPANY_DIRECTORY_TOKEN_URL?.trim()
      && process.env.BOLAGSVERKET_CLIENT_ID?.trim()
      && process.env.BOLAGSVERKET_CLIENT_SECRET?.trim(),
    ),
    provider: process.env.COMPANY_DIRECTORY_PROVIDER?.trim() || "bolagsverket_vardefulla_datamangder",
    batchSize: boundedInteger(process.env.COMPANY_DIRECTORY_BATCH_SIZE, 10, PILOT_MAX_BATCH_SIZE),
    maxPages: boundedInteger(process.env.COMPANY_DIRECTORY_MAX_PAGES_PER_RUN, 2, PILOT_MAX_PAGES_PER_RUN),
    pilotLocations: ["Stockholm", "Södertälje"],
  };
}

export async function getCompanyDirectoryAdminSnapshot(input?: {
  status?: string;
  query?: string;
  page?: number;
  pageSize?: number;
}): Promise<CompanyDirectoryAdminSnapshot> {
  await requireSuperAdmin();
  const config = configSnapshot();
  const status = normalizeProfileStatus(input?.status);
  const query = normalizeProfileQuery(input?.query);
  const queryPattern = `%${query}%`;
  const categorySlug = categorySlugForQuery(query);
  const requestedPage = boundedInteger(input?.page, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = boundedInteger(input?.pageSize, DEFAULT_PROFILE_PAGE_SIZE, MAX_PROFILE_PAGE_SIZE);
  const sql = getSql();
  if (!sql) {
    return {
      schemaReady: false,
      config,
      counts: {},
      pendingClaims: 0,
      profilePage: { page: 1, pageSize, total: 0, totalPages: 1 },
      latestRuns: [],
      profiles: [],
    };
  }

  try {
    const [countRows, claimRows, runRows, filteredCountRows] = await Promise.all([
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
        select count(*)::int as count
        from company_directory_profiles p
        where (${status}::text = 'all' or p.publication_status = ${status})
          and (
            ${query}::text = ''
            or coalesce(p.display_name, '') ilike ${queryPattern}
            or coalesce(p.legal_name, '') ilike ${queryPattern}
            or coalesce(p.city, '') ilike ${queryPattern}
            or coalesce(p.municipality, '') ilike ${queryPattern}
            or coalesce(p.category_slug, '') ilike ${queryPattern}
            or (${categorySlug}::text <> '' and p.category_slug = ${categorySlug})
            or coalesce(p.primary_sni_code, '') ilike ${queryPattern}
            or coalesce(p.primary_sni_label, '') ilike ${queryPattern}
            or coalesce(p.public_slug, '') ilike ${queryPattern}
          )
      `,
    ]);

    const counts: Record<string, number> = {};
    for (const row of countRows) counts[text(row.publication_status)] = number(row.count);

    const filteredTotal = number(filteredCountRows[0]?.count);
    const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize));
    const page = Math.min(requestedPage, totalPages);
    const offset = (page - 1) * pageSize;

    const profileRows = await sql`
      select
        p.id::text, p.public_slug, p.display_name, p.legal_name, p.legal_form,
        p.city, p.municipality, p.category_slug, p.primary_sni_code,
        p.primary_sni_label, p.activity_description, p.publication_status,
        p.quality_score, p.privacy_blocked, p.auto_public_eligible,
        p.is_active, p.official_source, p.last_synced_at, p.updated_at::text as profile_updated_token,
        p.claimed_workspace_id,
        p.address_line1, p.postal_code, p.website_url,
        scb.phone as scb_phone, scb.email as scb_email, scb.postal_address as scb_postal_address,
        scb.last_synced_at as scb_last_synced_at,
        scb.source_payload_hash as scb_source_payload_hash,
        coalesce(jsonb_array_length(scb.conflicts), 0)::int as scb_conflict_count,
        f.registered_names, f.sni_codes, f.deregistration_date,
        f.advertising_blocked, f.ongoing_procedures,
        (
          f.profile_id is not null
          and f.last_synced_at >= p.last_synced_at
          and f.source_payload_hash <> ''
        ) as official_facts_fresh,
        (
          scb.profile_id is not null
          and scb.source_payload_hash <> ''
          and scb.last_synced_at >= now() - interval '7 days'
          and scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = p.updated_at::text
          and scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = f.last_synced_at::text
        ) as scb_snapshot_fresh
      from company_directory_profiles p
      left join company_directory_official_facts f on f.profile_id = p.id
      left join company_directory_scb_enrichment scb on scb.profile_id = p.id
      where (${status}::text = 'all' or p.publication_status = ${status})
        and (
          ${query}::text = ''
          or coalesce(p.display_name, '') ilike ${queryPattern}
          or coalesce(p.legal_name, '') ilike ${queryPattern}
          or coalesce(p.city, '') ilike ${queryPattern}
          or coalesce(p.municipality, '') ilike ${queryPattern}
          or coalesce(p.category_slug, '') ilike ${queryPattern}
          or (${categorySlug}::text <> '' and p.category_slug = ${categorySlug})
          or coalesce(p.primary_sni_code, '') ilike ${queryPattern}
          or coalesce(p.primary_sni_label, '') ilike ${queryPattern}
          or coalesce(p.public_slug, '') ilike ${queryPattern}
        )
      order by
        case p.publication_status
          when 'ready' then 0
          when 'review' then 1
          when 'blocked' then 2
          when 'inactive' then 3
          when 'published' then 4
          when 'claimed' then 5
          else 6
        end,
        p.quality_score desc,
        p.updated_at desc,
        p.id
      limit ${pageSize}
      offset ${offset}
    `;

    const profiles = profileRows.map((row) => {
      const categoryConfidence = assessCompanyDirectoryCategoryConfidence({
        categorySlug: text(row.category_slug),
        primarySniCode: text(row.primary_sni_code),
        legalName: text(row.legal_name),
        displayName: text(row.display_name),
        activityDescription: text(row.activity_description),
        registeredNames: row.registered_names,
        sniCodes: row.sni_codes,
      });

      const publishSafetyReasons: string[] = [];
      if (!Boolean(row.is_active)) publishSafetyReasons.push("organization_inactive");
      if (Boolean(row.privacy_blocked)) publishSafetyReasons.push("privacy_blocked");
      if (!Boolean(row.auto_public_eligible)) publishSafetyReasons.push("not_public_eligible");
      if (row.claimed_workspace_id) publishSafetyReasons.push("already_claimed");
      if (!categoryConfidence.officialFactsReady) publishSafetyReasons.push("official_facts_missing");
      if (!Boolean(row.official_facts_fresh)) publishSafetyReasons.push("official_facts_stale");
      if (!Boolean(row.scb_snapshot_fresh)) publishSafetyReasons.push("scb_evidence_stale");
      if (number(row.scb_conflict_count) > 0) publishSafetyReasons.push("scb_conflict");
      if (categoryConfidence.score < 95) publishSafetyReasons.push("category_confidence_below_95");
      if (row.deregistration_date) publishSafetyReasons.push("deregistered");
      if (jsonArray(row.ongoing_procedures).length > 0) publishSafetyReasons.push("ongoing_legal_procedure");
      if (Boolean(row.advertising_blocked)) publishSafetyReasons.push("advertising_blocked");
      const profileStatus = text(row.publication_status);
      if (profileStatus === "review" && publishSafetyReasons.length === 0) {
        publishSafetyReasons.push("review_recovery_eligible");
      } else if (profileStatus !== "ready" && profileStatus !== "review") {
        publishSafetyReasons.push("status_not_ready");
      }

      const scbPostal = row.scb_postal_address && typeof row.scb_postal_address === "object"
        ? row.scb_postal_address as Record<string, unknown>
        : {};
      const adminAddressLine = text(row.address_line1).trim() || text(scbPostal.addressLine).trim();
      const adminPostalCode = text(row.postal_code).trim() || text(scbPostal.postalCode).trim();
      const adminCity = text(row.city).trim() || text(scbPostal.city).trim();
      const adminAddress = [adminAddressLine, [adminPostalCode, adminCity].filter(Boolean).join(" ")].filter(Boolean).join(", ");
      const adminContactSignals = [
        `Admin · Telefon: ${text(row.scb_phone).trim() || "–"}`,
        `Admin · E-post: ${text(row.scb_email).trim() || "–"}`,
        `Admin · Webbplats: ${text(row.website_url).trim() || "–"}`,
        `Admin · Adress: ${adminAddress || "–"}`,
        `Admin · SCB-kontakt senast synkad: ${text(row.scb_last_synced_at).trim() || "–"}`,
      ];

      return {
        id: text(row.id),
        slug: text(row.public_slug),
        companyName: text(row.display_name),
        legalName: text(row.legal_name),
        legalForm: text(row.legal_form),
        city: text(row.city),
        municipality: text(row.municipality),
        categorySlug: text(row.category_slug),
        sniCode: text(row.primary_sni_code),
        sniLabel: text(row.primary_sni_label),
        activityDescription: text(row.activity_description),
        status: text(row.publication_status),
        qualityScore: number(row.quality_score),
        privacyBlocked: Boolean(row.privacy_blocked),
        active: Boolean(row.is_active),
        source: text(row.official_source),
        lastSyncedAt: text(row.last_synced_at),
        categoryConfidenceScore: categoryConfidence.score,
        categoryConfidenceLevel: categoryConfidence.level,
        categorySignals: [...adminContactSignals, ...categoryConfidence.signals],
        categoryWarnings: categoryConfidence.warnings,
        officialFactsReady: categoryConfidence.officialFactsReady,
        publishSafe: publishSafetyReasons.length === 0,
        publishSafetyReasons,
      };
    });

    return {
      schemaReady: true,
      config,
      counts,
      pendingClaims: number(claimRows[0]?.count),
      profilePage: { page, pageSize, total: filteredTotal, totalPages },
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
      profiles,
    };
  } catch (error) {
    if (isMissingDirectorySchema(error)) {
      return {
        schemaReady: false,
        config,
        counts: {},
        pendingClaims: 0,
        profilePage: { page: 1, pageSize, total: 0, totalPages: 1 },
        latestRuns: [],
        profiles: [],
      };
    }
    throw error;
  }
}
