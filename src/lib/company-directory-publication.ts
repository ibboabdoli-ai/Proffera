import "server-only";

import { assessCompanyDirectoryCategoryConfidence } from "@/lib/company-directory-category-confidence";
import { enrichCompanyDirectoryScbForProfile } from "@/lib/company-directory-scb-enrichment";
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
      p.updated_at::text as profile_updated_token,
      f.profile_id::text as facts_profile_id,
      f.registered_names, f.sni_codes, f.deregistration_date,
      f.advertising_blocked, f.ongoing_procedures,
      f.last_synced_at::text as facts_last_synced_token,
      f.source_payload_hash as facts_source_payload_hash,
      coalesce(jsonb_array_length(scb.conflicts), 0)::int as scb_conflict_count,
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

  const profileUpdatedToken = text(row.profile_updated_token);
  const factsLastSyncedToken = text(row.facts_last_synced_token);
  const factsSourcePayloadHash = text(row.facts_source_payload_hash);
  const officialFactsFresh = Boolean(row.official_facts_fresh);
  const scbSnapshotFresh = Boolean(row.scb_snapshot_fresh);
  const scbConflictCount = Number(row.scb_conflict_count ?? 0);

  if (!confidence.officialFactsReady || !officialFactsFresh) {
    return { ok: false, code: "not_ready" };
  }

  const unsafe = !Boolean(row.is_active)
    || Boolean(row.privacy_blocked)
    || !Boolean(row.auto_public_eligible)
    || Boolean(row.claimed_workspace_id)
    || Boolean(row.deregistration_date)
    || Boolean(row.advertising_blocked)
    || jsonArray(row.ongoing_procedures).length > 0
    || (scbSnapshotFresh && Number.isFinite(scbConflictCount) && scbConflictCount > 0);
  if (unsafe) return { ok: false, code: "unsafe" };
  if (confidence.score < 95) return { ok: false, code: "low_confidence" };

  if (!profileUpdatedToken || !factsLastSyncedToken || !factsSourcePayloadHash) {
    return { ok: false, code: "not_ready" };
  }

  // A fresh SCB snapshot is already bound to the exact profile and Official Facts
  // versions above. Reuse it instead of forcing another upstream call before every
  // publication attempt. Missing or stale SCB evidence is still refreshed live and
  // remains fail-closed if the registry is unavailable or reports a conflict.
  if (!scbSnapshotFresh) {
    try {
      const scb = await enrichCompanyDirectoryScbForProfile(profileId);
      if (scb.status !== "saved") {
        return { ok: false, code: "not_ready" };
      }
      if (scb.conflicts.length > 0) {
        return { ok: false, code: "unsafe" };
      }
    } catch (error) {
      console.error("SCB company directory enrichment failed before publication", error);
      return { ok: false, code: "not_ready" };
    }
  }

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
      and p.updated_at::text = ${profileUpdatedToken}
      and not exists (
        select 1
        from company_directory_discovery_queue queue
        where queue.state = 'failed'
          and (
            queue.profile_id = p.id
            or (
              queue.country_code = p.country_code
              and queue.organization_number = regexp_replace(p.organization_number, '\\D', '', 'g')
            )
          )
      )
      and exists (
        select 1
        from company_directory_official_facts f
        where f.profile_id = p.id
          and f.last_synced_at::text = ${factsLastSyncedToken}
          and f.last_synced_at >= p.last_synced_at
          and f.source_payload_hash = ${factsSourcePayloadHash}
          and f.deregistration_date is null
          and coalesce(f.advertising_blocked, false) = false
          and jsonb_array_length(coalesce(f.ongoing_procedures, '[]'::jsonb)) = 0
          and exists (
            select 1
            from company_directory_scb_enrichment scb
            where scb.profile_id = p.id
              and jsonb_array_length(coalesce(scb.conflicts, '[]'::jsonb)) = 0
              and scb.source_payload_hash <> ''
              and scb.last_synced_at >= now() - interval '7 days'
              and scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = p.updated_at::text
              and scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = f.last_synced_at::text
          )
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
