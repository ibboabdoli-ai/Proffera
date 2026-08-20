import "server-only";

import { createHash } from "node:crypto";
import { revalidateTag } from "next/cache";

import { PUBLISHED_DIRECTORY_LOCATION_SUGGESTIONS_TAG } from "@/lib/company-directory-cache";
import { getSql } from "@/lib/db/server";
import {
  assessDirectoryCandidate,
  buildDirectoryPublicSlug,
  type NormalizedDirectoryCandidate,
} from "@/lib/company-directory-policy";
import { mapPrimarySniToDirectorySearchService } from "@/lib/company-directory-service-taxonomy";
import {
  fetchOfficialCompanyDirectoryBatch,
  verifyOfficialCompanyCandidate,
} from "@/lib/company-directory-source";

const PILOT_MAX_PAGES_PER_RUN = 2;
const PILOT_MAX_BATCH_SIZE = 10;

const PROVENANCE_FIELDS: Array<keyof NormalizedDirectoryCandidate> = [
  "organizationNumber",
  "legalName",
  "legalForm",
  "organizationStatus",
  "isActive",
  "fTaxStatus",
  "vatStatus",
  "employerStatus",
  "primarySniCode",
  "primarySniLabel",
  "activityDescription",
  "addressLine1",
  "postalCode",
  "city",
  "municipality",
  "region",
];

function hashValue(value: unknown) {
  const normalized = value instanceof Date ? value.toISOString() : JSON.stringify(value ?? null);
  return createHash("sha256").update(normalized).digest("hex");
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function boundedInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

export type CompanyDirectorySyncResult = {
  provider: string;
  scanned: number;
  upserted: number;
  published: number;
  blocked: number;
  errors: number;
  nextCursor: string | null;
  runId: string;
};

async function lastCompletedCursor(provider: string) {
  const sql = getSql();
  if (!sql) return "";
  const rows = await sql`
    select cursor_value
    from company_directory_sync_runs
    where provider = ${provider} and status = 'completed'
    order by completed_at desc nulls last, started_at desc
    limit 1
  `;
  return String(rows[0]?.cursor_value ?? "");
}

async function startRun(provider: string) {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  await sql`
    update company_directory_sync_runs
    set status = 'failed',
        error_count = greatest(error_count, 1),
        error_summary = case
          when error_summary = '' then 'stale sync lease recovered automatically'
          else error_summary
        end,
        completed_at = now()
    where provider = ${provider}
      and status = 'running'
      and started_at < now() - interval '15 minutes'
  `;

  const rows = await sql`
    insert into company_directory_sync_runs (provider, status)
    values (${provider}, 'running')
    on conflict do nothing
    returning id::text
  `;
  const id = String(rows[0]?.id ?? "");
  if (!id) throw new Error("Company directory sync already running");
  return id;
}

export async function upsertCompanyDirectoryCandidate(candidate: NormalizedDirectoryCandidate) {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  const assessment = assessDirectoryCandidate(candidate);
  const desiredStatus = assessment.publicationStatus;
  const publicSlug = buildDirectoryPublicSlug(candidate);
  const servicesJson = JSON.stringify(assessment.category?.serviceSlugs ?? []);
  const reasons = JSON.stringify(assessment.reasons);
  const sourceUpdatedAt = candidate.sourceUpdatedAt?.toISOString() ?? null;

  const rows = await sql`
    insert into company_directory_profiles (
      country_code, organization_number, organization_kind, legal_name, display_name,
      legal_form, organization_status, is_active, f_tax_status, vat_status, employer_status,
      primary_sni_code, primary_sni_label, category_slug, service_slugs, activity_description,
      address_line1, postal_code, city, municipality, region, public_slug,
      publication_status, quality_score, quality_reasons, privacy_blocked, auto_public_eligible,
      official_source, source_record_id, source_updated_at, last_synced_at, published_at
    ) values (
      ${candidate.countryCode}, ${candidate.organizationNumber}, ${candidate.organizationKind}, ${candidate.legalName}, ${candidate.displayName},
      ${candidate.legalForm}, ${candidate.organizationStatus}, ${candidate.isActive}, ${candidate.fTaxStatus}, ${candidate.vatStatus}, ${candidate.employerStatus},
      ${candidate.primarySniCode}, ${candidate.primarySniLabel}, ${assessment.category?.categorySlug ?? ""},
      array(select jsonb_array_elements_text(${servicesJson}::jsonb)), ${candidate.activityDescription},
      ${candidate.addressLine1}, ${candidate.postalCode}, ${candidate.city}, ${candidate.municipality}, ${candidate.region}, ${publicSlug},
      ${desiredStatus}, ${assessment.score}, ${reasons}::jsonb, ${assessment.privacyBlocked}, ${assessment.autoPublicEligible},
      ${candidate.officialSource}, ${candidate.sourceRecordId}, ${sourceUpdatedAt}::timestamptz, now(),
      case when ${desiredStatus} = 'published' then now() else null end
    )
    on conflict (country_code, organization_number) do update set
      organization_kind = excluded.organization_kind,
      legal_name = excluded.legal_name,
      display_name = case when company_directory_profiles.claimed_workspace_id is null then excluded.display_name else company_directory_profiles.display_name end,
      legal_form = excluded.legal_form,
      organization_status = excluded.organization_status,
      is_active = excluded.is_active,
      f_tax_status = excluded.f_tax_status,
      vat_status = excluded.vat_status,
      employer_status = excluded.employer_status,
      primary_sni_code = excluded.primary_sni_code,
      primary_sni_label = excluded.primary_sni_label,
      category_slug = excluded.category_slug,
      service_slugs = excluded.service_slugs,
      activity_description = excluded.activity_description,
      address_line1 = excluded.address_line1,
      postal_code = excluded.postal_code,
      city = excluded.city,
      municipality = excluded.municipality,
      region = excluded.region,
      publication_status = case
        when company_directory_profiles.claimed_workspace_id is not null then 'claimed'
        when company_directory_profiles.publication_status = 'published'
          and excluded.publication_status = 'ready'
          and excluded.privacy_blocked = false
          and excluded.auto_public_eligible = true
          then 'published'
        else excluded.publication_status
      end,
      quality_score = excluded.quality_score,
      quality_reasons = excluded.quality_reasons,
      privacy_blocked = excluded.privacy_blocked,
      auto_public_eligible = excluded.auto_public_eligible,
      official_source = excluded.official_source,
      source_record_id = excluded.source_record_id,
      source_updated_at = coalesce(excluded.source_updated_at, company_directory_profiles.source_updated_at),
      last_synced_at = now(),
      published_at = case
        when company_directory_profiles.claimed_workspace_id is not null then company_directory_profiles.published_at
        when company_directory_profiles.publication_status = 'published'
          and excluded.publication_status = 'ready'
          and excluded.privacy_blocked = false
          and excluded.auto_public_eligible = true
          then coalesce(company_directory_profiles.published_at, now())
        when excluded.publication_status = 'published' then coalesce(company_directory_profiles.published_at, now())
        else null
      end,
      updated_at = now()
    returning id::text, publication_status, category_slug
  `;

  const profileId = String(rows[0]?.id ?? "");
  if (!profileId) throw new Error(`Directory upsert failed for ${candidate.organizationNumber}`);
  revalidateTag(PUBLISHED_DIRECTORY_LOCATION_SUGGESTIONS_TAG, { expire: 0 });

  const sniServiceSlug = mapPrimarySniToDirectorySearchService(candidate.primarySniCode);
  if (sniServiceSlug) {
    await sql`
      insert into company_directory_profile_services (
        profile_id, service_slug, source_type, confidence, is_primary, is_active, public_visible, updated_at
      )
      select ${profileId}::uuid, service.slug, 'sni', 85, true, true, true, now()
      from company_directory_services service
      where service.slug = ${sniServiceSlug}
        and service.is_active = true
      on conflict (profile_id, service_slug)
      do update set
        confidence = excluded.confidence,
        is_primary = true,
        is_active = true,
        public_visible = true,
        updated_at = now()
      where company_directory_profile_services.source_type = 'sni'
    `;
  }

  await sql`
    update company_directory_profile_services
    set is_primary = false,
        is_active = false,
        public_visible = false,
        updated_at = now()
    where profile_id = ${profileId}::uuid
      and source_type = 'sni'
      and (${sniServiceSlug ?? ""}::text = '' or service_slug <> ${sniServiceSlug ?? ""})
  `;

  const provenanceJson = JSON.stringify(PROVENANCE_FIELDS.map((field) => ({
    fieldName: String(field),
    valueHash: hashValue(candidate[field]),
  })));
  await sql`
    insert into company_directory_field_sources (
      profile_id, field_name, source_name, source_record_id, value_hash, confidence, observed_at
    )
    select
      ${profileId}::uuid,
      item->>'fieldName',
      ${candidate.officialSource},
      ${candidate.sourceRecordId},
      item->>'valueHash',
      100,
      now()
    from jsonb_array_elements(${provenanceJson}::jsonb) item
    on conflict (profile_id, field_name, source_name, value_hash)
    do update set observed_at = excluded.observed_at
  `;

  const categorySlug = String(rows[0]?.category_slug ?? "");
  if (categorySlug) {
    const categoryImageUrl = `/api/public-directory/category-image/${encodeURIComponent(categorySlug)}`;

    await sql`
      update company_directory_media
      set is_primary = false,
          publication_status = 'rejected',
          updated_at = now()
      where profile_id = ${profileId}::uuid
        and source_type = 'generated_category'
        and publication_status = 'published'
        and public_url <> ${categoryImageUrl}
    `;

    await sql`
      insert into company_directory_media (
        profile_id, media_kind, source_type, public_url, attribution, license_status,
        rights_confirmed_at, is_actual_business_media, is_primary, publication_status
      )
      select ${profileId}::uuid, 'category_illustration', 'generated_category', ${categoryImageUrl},
        'Illustrationsbild från Proffera', 'generated', now(), false,
        not exists (
          select 1 from company_directory_media media
          where media.profile_id = ${profileId}::uuid
            and media.publication_status = 'published'
            and media.is_primary = true
        ),
        'published'
      where not exists (
        select 1 from company_directory_media media
        where media.profile_id = ${profileId}::uuid
          and media.source_type = 'generated_category'
          and media.public_url = ${categoryImageUrl}
          and media.publication_status = 'published'
      )
    `;
  }

  return {
    profileId,
    publicationStatus: String(rows[0]?.publication_status ?? desiredStatus),
    blocked: assessment.privacyBlocked || assessment.publicationStatus === "blocked",
  };
}

async function finishRun(input: {
  runId: string;
  cursor: string;
  scanned: number;
  upserted: number;
  published: number;
  blocked: number;
  errors: number;
  errorSummary?: string;
  failed?: boolean;
}) {
  const sql = getSql();
  if (!sql) return;
  await sql`
    update company_directory_sync_runs
    set status = ${input.failed ? "failed" : "completed"},
        cursor_value = ${input.cursor},
        scanned_count = ${input.scanned},
        upserted_count = ${input.upserted},
        published_count = ${input.published},
        blocked_count = ${input.blocked},
        error_count = ${input.errors},
        error_summary = ${input.errorSummary ?? ""},
        completed_at = now()
    where id = ${input.runId}::uuid
  `;
}

export async function syncCompanyDirectory(): Promise<CompanyDirectorySyncResult> {
  if (!getSql()) throw new Error("Database is not configured");

  const provider = process.env.COMPANY_DIRECTORY_PROVIDER?.trim() || "bolagsverket_vardefulla_datamangder";
  const startCursor = await lastCompletedCursor(provider);
  const runId = await startRun(provider);
  const maxPages = boundedInteger(process.env.COMPANY_DIRECTORY_MAX_PAGES_PER_RUN, 2, PILOT_MAX_PAGES_PER_RUN);
  const batchSize = boundedInteger(process.env.COMPANY_DIRECTORY_BATCH_SIZE, 10, PILOT_MAX_BATCH_SIZE);

  let cursor = startCursor;
  let nextCursor: string | null = startCursor || null;
  let scanned = 0;
  let upserted = 0;
  let published = 0;
  let blocked = 0;
  let errors = 0;
  const errorMessages: string[] = [];

  try {
    for (let page = 0; page < maxPages; page += 1) {
      const batch = await fetchOfficialCompanyDirectoryBatch({ cursor, limit: batchSize });
      scanned += batch.items.length;

      for (const discoveredCandidate of batch.items) {
        try {
          const candidate = await verifyOfficialCompanyCandidate(discoveredCandidate);
          const result = await upsertCompanyDirectoryCandidate(candidate);
          upserted += 1;
          if (result.publicationStatus === "published") published += 1;
          if (result.blocked) blocked += 1;
        } catch (error) {
          errors += 1;
          if (errorMessages.length < 8) errorMessages.push(error instanceof Error ? error.message : "Unknown candidate error");
        }
      }

      nextCursor = batch.nextCursor;
      if (!nextCursor || nextCursor === cursor) {
        cursor = "";
        break;
      }
      cursor = nextCursor;
    }

    await finishRun({
      runId,
      cursor: nextCursor ?? "",
      scanned,
      upserted,
      published,
      blocked,
      errors,
      errorSummary: errorMessages.join(" | "),
    });

    return { provider, scanned, upserted, published, blocked, errors, nextCursor, runId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown company directory sync error";
    await finishRun({
      runId,
      cursor,
      scanned,
      upserted,
      published,
      blocked,
      errors: errors + 1,
      errorSummary: [message, ...errorMessages].slice(0, 8).join(" | "),
      failed: true,
    });
    throw error;
  }
}

export type PublicDirectoryBusiness = {
  id: string;
  slug: string;
  companyName: string;
  legalForm: string;
  organizationStatus: string;
  categorySlug: string;
  primarySniLabel: string;
  activityDescription: string;
  addressLine1: string;
  postalCode: string;
  city: string;
  municipality: string;
  region: string;
  qualityScore: number;
  officialSource: string;
  sourceUpdatedAt: string;
  lastCheckedAt: string;
  media: {
    url: string;
    kind: string;
    attribution: string;
    isActualBusinessMedia: boolean;
  } | null;
};

export async function getPublicDirectoryBusiness(slug: string): Promise<PublicDirectoryBusiness | null> {
  const normalized = slug.trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized)) return null;
  const sql = getSql();
  if (!sql) return null;

  const rows = await sql`
    select
      profile.id::text,
      profile.public_slug,
      profile.display_name,
      profile.legal_form,
      profile.organization_status,
      profile.category_slug,
      profile.primary_sni_label,
      profile.activity_description,
      profile.address_line1,
      profile.postal_code,
      profile.city,
      profile.municipality,
      profile.region,
      profile.quality_score,
      profile.official_source,
      profile.source_updated_at,
      profile.last_synced_at,
      media.public_url as media_url,
      media.media_kind,
      media.attribution,
      media.is_actual_business_media
    from company_directory_profiles profile
    left join lateral (
      select public_url, media_kind, attribution, is_actual_business_media
      from company_directory_media
      where profile_id = profile.id and publication_status = 'published'
      order by is_primary desc, is_actual_business_media desc, created_at desc
      limit 1
    ) media on true
    where profile.public_slug = ${normalized}
      and profile.publication_status = 'published'
      and profile.privacy_blocked = false
      and profile.auto_public_eligible = true
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  return {
    id: String(row.id),
    slug: String(row.public_slug),
    companyName: String(row.display_name),
    legalForm: String(row.legal_form ?? ""),
    organizationStatus: String(row.organization_status ?? ""),
    categorySlug: String(row.category_slug ?? ""),
    primarySniLabel: String(row.primary_sni_label ?? ""),
    activityDescription: String(row.activity_description ?? ""),
    addressLine1: String(row.address_line1 ?? ""),
    postalCode: String(row.postal_code ?? ""),
    city: String(row.city ?? ""),
    municipality: String(row.municipality ?? ""),
    region: String(row.region ?? ""),
    qualityScore: number(row.quality_score),
    officialSource: String(row.official_source ?? ""),
    sourceUpdatedAt: row.source_updated_at ? new Date(String(row.source_updated_at)).toISOString() : "",
    lastCheckedAt: row.last_synced_at ? new Date(String(row.last_synced_at)).toISOString() : "",
    media: row.media_url ? {
      url: String(row.media_url),
      kind: String(row.media_kind ?? ""),
      attribution: String(row.attribution ?? ""),
      isActualBusinessMedia: Boolean(row.is_actual_business_media),
    } : null,
  };
}
