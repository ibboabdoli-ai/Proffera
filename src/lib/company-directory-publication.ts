import "server-only";

import { assessCompanyDirectoryCategoryConfidence } from "@/lib/company-directory-category-confidence";
import { getSql } from "@/lib/db/server";

export type CompanyDirectoryPublicationResult = {
  ok: boolean;
  code: "published" | "invalid" | "not_found" | "not_ready" | "unsafe" | "low_confidence" | "database";
  slug?: string;
};

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

function timestamp(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

export async function publishCompanyDirectoryProfileIfSafe(
  profileId: string,
): Promise<CompanyDirectoryPublicationResult> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(profileId)) {
    return { ok: false, code: "invalid" };
  }

  const sql = getSql();
  if (!sql) return { ok: false, code: "database" };

  const rows = await sql`
    select
      p.id::text, p.public_slug, p.display_name, p.legal_name,
      p.category_slug, p.primary_sni_code, p.activity_description,
      p.publication_status, p.is_active, p.privacy_blocked,
      p.auto_public_eligible, p.claimed_workspace_id,
      p.last_synced_at as profile_last_synced_at,
      p.updated_at as profile_updated_at,
      f.profile_id::text as facts_profile_id,
      f.registered_names, f.sni_codes, f.deregistration_date,
      f.advertising_blocked, f.ongoing_procedures,
      f.last_synced_at as facts_last_synced_at,
      f.source_payload_hash as facts_source_payload_hash
    from company_directory_profiles p
    left join company_directory_official_facts f on f.profile_id = p.id
    where p.id = ${profileId}::uuid
    limit 1
  `;
  const row = rows[0];
  if (!row) return { ok: false, code: "not_found" };
  if (text(row.publication_status) !== "ready") return { ok: false, code: "not_ready" };

  const confidence = assessCompanyDirectoryCategoryConfidence({
    categorySlug: text(row.category_slug),
    primarySniCode: text(row.primary_sni_code),
    legalName: text(row.legal_name),
    displayName: text(row.display_name),
    activityDescription: text(row.activity_description),
    registeredNames: row.registered_names,
    sniCodes: row.sni_codes,
  });

  const profileLastSyncedAt = timestamp(row.profile_last_synced_at);
  const profileUpdatedAt = timestamp(row.profile_updated_at);
  const factsLastSyncedAt = timestamp(row.facts_last_synced_at);
  const factsSourcePayloadHash = text(row.facts_source_payload_hash);
  const officialFactsFresh = Boolean(
    row.facts_profile_id
      && profileLastSyncedAt
      && profileUpdatedAt
      && factsLastSyncedAt
      && factsSourcePayloadHash
      && factsLastSyncedAt.getTime() >= profileLastSyncedAt.getTime(),
  );

  const unsafe = !Boolean(row.is_active)
    || Boolean(row.privacy_blocked)
    || !Boolean(row.auto_public_eligible)
    || Boolean(row.claimed_workspace_id)
    || !confidence.officialFactsReady
    || !officialFactsFresh
    || Boolean(row.deregistration_date)
    || Boolean(row.advertising_blocked)
    || jsonArray(row.ongoing_procedures).length > 0;
  if (unsafe) return { ok: false, code: "unsafe" };
  if (confidence.score < 95) return { ok: false, code: "low_confidence" };

  const profileUpdatedIso = profileUpdatedAt!.toISOString();
  const factsLastSyncedIso = factsLastSyncedAt!.toISOString();
  const updated = await sql`
    update company_directory_profiles p
    set publication_status = 'published',
        published_at = coalesce(p.published_at, now()),
        updated_at = now()
    where p.id = ${profileId}::uuid
      and p.publication_status = 'ready'
      and p.is_active = true
      and p.privacy_blocked = false
      and p.auto_public_eligible = true
      and p.claimed_workspace_id is null
      and p.updated_at = ${profileUpdatedIso}::timestamptz
      and exists (
        select 1
        from company_directory_official_facts f
        where f.profile_id = p.id
          and f.last_synced_at = ${factsLastSyncedIso}::timestamptz
          and f.last_synced_at >= p.last_synced_at
          and f.source_payload_hash = ${factsSourcePayloadHash}
          and f.deregistration_date is null
          and coalesce(f.advertising_blocked, false) = false
          and jsonb_array_length(coalesce(f.ongoing_procedures, '[]'::jsonb)) = 0
      )
    returning p.public_slug
  `;
  if (!updated[0]) return { ok: false, code: "not_ready" };

  return { ok: true, code: "published", slug: text(updated[0].public_slug) };
}

export async function autoPublishCompanyDirectoryProfileIfSafe(
  profileId: string,
): Promise<CompanyDirectoryPublicationResult | null> {
  if (process.env.COMPANY_DIRECTORY_AUTO_PUBLISH?.trim().toLowerCase() !== "true") return null;
  return publishCompanyDirectoryProfileIfSafe(profileId);
}
