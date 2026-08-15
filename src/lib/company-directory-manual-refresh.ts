import "server-only";

import { assessCompanyDirectoryCategoryConfidence } from "@/lib/company-directory-category-confidence";
import { enrichCompanyDirectoryOfficialFactsForProfile } from "@/lib/company-directory-official-facts";
import { publishCompanyDirectoryProfileIfSafe } from "@/lib/company-directory-publication";
import { getSql } from "@/lib/db/server";

const DEFAULT_BATCH_SIZE = 3;
const MAX_BATCH_SIZE = 5;
const RATE_LIMIT_RETRY_SECONDS = 65;

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function boundedLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(parsed)));
}

function validTimestamp(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : "";
}

function isOfficialFactsRateLimit(error: unknown) {
  return error instanceof Error
    && /Official facts (?:lookup|OAuth) failed \(429\)/.test(error.message);
}

async function resolveScanStartedAt(
  sql: NonNullable<ReturnType<typeof getSql>>,
  requested: unknown,
) {
  const requestedIso = validTimestamp(requested);
  if (!requestedIso) {
    const rows = await sql`select now()::text as scan_started_at`;
    return text(rows[0]?.scan_started_at);
  }

  const rows = await sql`
    select least(${requestedIso}::timestamptz, now())::text as scan_started_at
  `;
  return text(rows[0]?.scan_started_at);
}

async function lowConfidenceCandidates(
  sql: NonNullable<ReturnType<typeof getSql>>,
  scanStartedAt: string,
) {
  const rows = await sql`
    select
      p.id::text,
      p.category_slug,
      p.primary_sni_code,
      p.legal_name,
      p.display_name,
      p.activity_description,
      f.registered_names,
      f.sni_codes,
      f.last_synced_at::text as facts_last_synced_at
    from company_directory_profiles p
    join company_directory_official_facts f on f.profile_id = p.id
    where p.publication_status = 'ready'
      and p.country_code = 'SE'
      and f.source_payload_hash <> ''
      and f.last_synced_at < ${scanStartedAt}::timestamptz
    order by f.last_synced_at asc, p.organization_number asc
  `;

  return rows.filter((row) => {
    const categoryConfidence = assessCompanyDirectoryCategoryConfidence({
      categorySlug: text(row.category_slug),
      primarySniCode: text(row.primary_sni_code),
      legalName: text(row.legal_name),
      displayName: text(row.display_name),
      activityDescription: text(row.activity_description),
      registeredNames: row.registered_names,
      sniCodes: row.sni_codes,
    });

    return categoryConfidence.officialFactsReady && categoryConfidence.score < 95;
  });
}

export type CompanyDirectoryManualRefreshBatch = {
  scanStartedAt: string;
  selected: number;
  refreshed: number;
  published: number;
  stillBelow95: number;
  blockedBySafety: number;
  deferred: number;
  errors: number;
  remaining: number;
  completed: boolean;
  rateLimited: boolean;
  retryAfterSeconds: number;
  publishedSlugs: string[];
  errorSummary: string;
};

export async function refreshLowConfidenceCompanyDirectoryBatch(input?: {
  scanStartedAt?: string;
  limit?: number;
}): Promise<CompanyDirectoryManualRefreshBatch> {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  const scanStartedAt = await resolveScanStartedAt(sql, input?.scanStartedAt);
  const limit = boundedLimit(input?.limit);
  const candidates = await lowConfidenceCandidates(sql, scanStartedAt);
  const selected = candidates.slice(0, limit);

  let refreshed = 0;
  let published = 0;
  let stillBelow95 = 0;
  let blockedBySafety = 0;
  let deferred = 0;
  let errors = 0;
  let rateLimited = false;
  let retryAfterSeconds = 0;
  const publishedSlugs: string[] = [];
  const errorSummary: string[] = [];

  for (const row of selected) {
    const profileId = text(row.id);

    try {
      await enrichCompanyDirectoryOfficialFactsForProfile(profileId);
      refreshed += 1;

      const publication = await publishCompanyDirectoryProfileIfSafe(profileId);
      if (publication.code === "published") {
        published += 1;
        if (publication.slug) publishedSlugs.push(publication.slug);
      } else if (publication.code === "low_confidence") {
        stillBelow95 += 1;
      } else if (publication.code === "unsafe") {
        blockedBySafety += 1;
      } else {
        deferred += 1;
      }
    } catch (error) {
      if (isOfficialFactsRateLimit(error)) {
        rateLimited = true;
        retryAfterSeconds = RATE_LIMIT_RETRY_SECONDS;
        if (errorSummary.length < 3) {
          errorSummary.push(`Bolagsverket rate limit nådd. Vänta ${RATE_LIMIT_RETRY_SECONDS} sekunder.`);
        }
        break;
      }

      errors += 1;
      if (errorSummary.length < 3) {
        errorSummary.push(error instanceof Error ? error.message : "Unknown refresh error");
      }
    }
  }

  // The batch starts from a fixed snapshot cutoff. Every successfully refreshed row
  // receives a new last_synced_at and therefore leaves this snapshot. Reuse the
  // already-loaded candidate set instead of scanning the entire backlog a second time.
  // The next batch recalculates the snapshot, so concurrent refreshes can only make this
  // conservative count shrink sooner on the following request.
  const remaining = Math.max(0, candidates.length - refreshed);

  return {
    scanStartedAt,
    selected: selected.length,
    refreshed,
    published,
    stillBelow95,
    blockedBySafety,
    deferred,
    errors,
    remaining,
    completed: remaining === 0,
    rateLimited,
    retryAfterSeconds,
    publishedSlugs,
    errorSummary: errorSummary.join(" | "),
  };
}
