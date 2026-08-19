import "server-only";

import { assessCompanyDirectoryCategoryConfidence } from "@/lib/company-directory-category-confidence";
import { enrichCompanyDirectoryOfficialFactsForProfile } from "@/lib/company-directory-official-facts";
import { enrichCompanyDirectoryScbForProfile } from "@/lib/company-directory-scb-enrichment";
import { createScbCompanyRegistryTransportFromEnv } from "@/lib/company-directory-scb-transport";
import { getSql } from "@/lib/db/server";

const REVALIDATION_PROVIDER = "published_revalidation";
const DEFAULT_REVALIDATION_BATCH_SIZE = 2;
const MAX_REVALIDATION_BATCH_SIZE = 3;

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function boundedLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_REVALIDATION_BATCH_SIZE;
  return Math.max(1, Math.min(MAX_REVALIDATION_BATCH_SIZE, Math.floor(parsed)));
}

async function startRun() {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  await sql`
    update company_directory_sync_runs
    set status = 'failed',
        error_count = greatest(error_count, 1),
        error_summary = case
          when error_summary = '' then 'stale published revalidation lease recovered automatically'
          else error_summary
        end,
        completed_at = now()
    where provider = ${REVALIDATION_PROVIDER}
      and status = 'running'
      and started_at < now() - interval '10 minutes'
  `;

  const rows = await sql`
    insert into company_directory_sync_runs (provider, status)
    values (${REVALIDATION_PROVIDER}, 'running')
    on conflict do nothing
    returning id::text
  `;

  return text(rows[0]?.id) || null;
}

async function finishRun(input: {
  runId: string;
  selected: number;
  revalidated: number;
  keptPublished: number;
  movedToReview: number;
  errors: number;
  errorSummary: string;
  failed?: boolean;
}) {
  const sql = getSql();
  if (!sql) return;

  await sql`
    update company_directory_sync_runs
    set status = ${input.failed ? "failed" : "completed"},
        scanned_count = ${input.selected},
        upserted_count = ${input.revalidated},
        published_count = ${input.keptPublished},
        blocked_count = ${input.movedToReview},
        error_count = ${input.errors},
        error_summary = ${input.errorSummary},
        completed_at = now()
    where id = ${input.runId}::uuid
  `;
}

async function selectCandidates(limit: number) {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  return await sql`
    select profile.id::text, profile.organization_number, profile.display_name
    from company_directory_profiles profile
    left join company_directory_official_facts facts on facts.profile_id = profile.id
    left join company_directory_scb_enrichment scb on scb.profile_id = profile.id
    where profile.publication_status = 'published'
      and profile.country_code = 'SE'
      and profile.organization_kind = 'juridical_person'
      and profile.claimed_workspace_id is null
      and length(regexp_replace(profile.organization_number, '\\D', '', 'g')) = 10
      and (
        facts.profile_id is null
        or facts.source_payload_hash = ''
        or facts.last_synced_at < profile.last_synced_at
        or scb.profile_id is null
        or scb.source_payload_hash = ''
        or scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' is distinct from profile.updated_at::text
        or scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' is distinct from facts.last_synced_at::text
      )
    order by
      case when facts.profile_id is null then 0 else 1 end,
      case when scb.profile_id is null then 0 else 1 end,
      scb.last_synced_at asc nulls first,
      profile.organization_number asc
    limit ${limit}
  `;
}

async function backlogCount() {
  const sql = getSql();
  if (!sql) return 0;

  const rows = await sql`
    select count(*)::int as count
    from company_directory_profiles profile
    left join company_directory_official_facts facts on facts.profile_id = profile.id
    left join company_directory_scb_enrichment scb on scb.profile_id = profile.id
    where profile.publication_status = 'published'
      and profile.country_code = 'SE'
      and profile.organization_kind = 'juridical_person'
      and profile.claimed_workspace_id is null
      and length(regexp_replace(profile.organization_number, '\\D', '', 'g')) = 10
      and (
        facts.profile_id is null
        or facts.source_payload_hash = ''
        or facts.last_synced_at < profile.last_synced_at
        or scb.profile_id is null
        or scb.source_payload_hash = ''
        or scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' is distinct from profile.updated_at::text
        or scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' is distinct from facts.last_synced_at::text
      )
  `;

  return Math.max(0, number(rows[0]?.count));
}

async function loadFreshEvaluation(profileId: string) {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  const rows = await sql`
    select
      profile.id::text,
      profile.country_code,
      profile.organization_kind,
      profile.publication_status,
      profile.category_slug,
      profile.primary_sni_code,
      profile.legal_name,
      profile.display_name,
      profile.activity_description,
      profile.is_active,
      profile.privacy_blocked,
      profile.auto_public_eligible,
      profile.claimed_workspace_id,
      profile.updated_at::text as profile_updated_token,
      facts.registered_names,
      facts.sni_codes,
      facts.deregistration_date,
      facts.advertising_blocked,
      facts.ongoing_procedures,
      facts.last_synced_at::text as facts_last_synced_token,
      facts.source_payload_hash as facts_source_payload_hash,
      scb.source_payload_hash as scb_source_payload_hash,
      coalesce(jsonb_array_length(scb.conflicts), 0)::int as scb_conflict_count,
      (
        facts.profile_id is not null
        and facts.last_synced_at >= profile.last_synced_at
        and facts.source_payload_hash <> ''
      ) as official_facts_fresh,
      (
        scb.profile_id is not null
        and scb.source_payload_hash <> ''
        and scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = profile.updated_at::text
        and scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = facts.last_synced_at::text
      ) as scb_snapshot_fresh
    from company_directory_profiles profile
    left join company_directory_official_facts facts on facts.profile_id = profile.id
    left join company_directory_scb_enrichment scb on scb.profile_id = profile.id
    where profile.id = ${profileId}::uuid
    limit 1
  `;

  return rows[0] ?? null;
}

async function movePublishedProfileToReview(input: {
  profileId: string;
  profileUpdatedToken: string;
  factsLastSyncedToken: string;
  factsSourcePayloadHash: string;
  scbSourcePayloadHash: string;
}) {
  const sql = getSql();
  if (!sql) return false;

  const rows = await sql`
    update company_directory_profiles profile
    set publication_status = 'review',
        published_at = null,
        updated_at = now()
    where profile.id = ${input.profileId}::uuid
      and profile.publication_status = 'published'
      and profile.country_code = 'SE'
      and profile.organization_kind = 'juridical_person'
      and profile.claimed_workspace_id is null
      and profile.updated_at::text = ${input.profileUpdatedToken}
      and exists (
        select 1
        from company_directory_official_facts facts
        where facts.profile_id = profile.id
          and facts.last_synced_at::text = ${input.factsLastSyncedToken}
          and facts.source_payload_hash = ${input.factsSourcePayloadHash}
      )
      and exists (
        select 1
        from company_directory_scb_enrichment scb
        where scb.profile_id = profile.id
          and scb.source_payload_hash = ${input.scbSourcePayloadHash}
          and scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = profile.updated_at::text
          and scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = ${input.factsLastSyncedToken}
      )
    returning profile.id::text
  `;

  return Boolean(rows[0]);
}

export async function revalidatePublishedCompanyDirectoryBatch(limit?: number) {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  const safeLimit = boundedLimit(limit);
  let transport;
  try {
    transport = createScbCompanyRegistryTransportFromEnv();
  } catch (error) {
    return {
      skipped: true,
      reason: "scb_access_invalid",
      selected: 0,
      revalidated: 0,
      keptPublished: 0,
      movedToReview: 0,
      deferred: 0,
      errors: 1,
      errorSummary: error instanceof Error ? error.message : "SCB access configuration is invalid",
      remaining: await backlogCount(),
    };
  }

  if (!transport) {
    return {
      skipped: true,
      reason: "scb_access_not_configured",
      selected: 0,
      revalidated: 0,
      keptPublished: 0,
      movedToReview: 0,
      deferred: 0,
      errors: 0,
      errorSummary: "",
      remaining: await backlogCount(),
    };
  }

  const runId = await startRun();
  if (!runId) {
    return {
      skipped: true,
      reason: "already_running",
      selected: 0,
      revalidated: 0,
      keptPublished: 0,
      movedToReview: 0,
      deferred: 0,
      errors: 0,
      errorSummary: "",
      remaining: await backlogCount(),
    };
  }

  const candidates = await selectCandidates(safeLimit);
  let revalidated = 0;
  let keptPublished = 0;
  let movedToReview = 0;
  let deferred = 0;
  let errors = 0;
  const errorMessages: string[] = [];
  const reviewMessages: string[] = [];

  try {
    for (const candidate of candidates) {
      const profileId = text(candidate.id);
      const organizationNumber = text(candidate.organization_number).replace(/\D/g, "");
      if (!profileId || organizationNumber.length !== 10) {
        errors += 1;
        if (errorMessages.length < 5) errorMessages.push("Published revalidation candidate is invalid");
        continue;
      }

      try {
        await enrichCompanyDirectoryOfficialFactsForProfile(profileId);
        const scb = await enrichCompanyDirectoryScbForProfile(profileId, transport, {
          allowWhenDisabledWithExplicitTransport: true,
        });

        if (scb.status !== "saved") {
          deferred += 1;
          if (errorMessages.length < 5) {
            errorMessages.push(`${organizationNumber}: SCB revalidation deferred (${scb.status})`);
          }
          continue;
        }

        const row = await loadFreshEvaluation(profileId);
        if (!row || text(row.publication_status) !== "published") {
          deferred += 1;
          continue;
        }

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
        const scbSourcePayloadHash = text(row.scb_source_payload_hash);
        const snapshotsFresh = Boolean(row.official_facts_fresh) && Boolean(row.scb_snapshot_fresh);
        if (
          !snapshotsFresh
          || !profileUpdatedToken
          || !factsLastSyncedToken
          || !factsSourcePayloadHash
          || !scbSourcePayloadHash
        ) {
          deferred += 1;
          continue;
        }

        const unsafe = text(row.country_code) !== "SE"
          || text(row.organization_kind) !== "juridical_person"
          || !Boolean(row.is_active)
          || Boolean(row.privacy_blocked)
          || !Boolean(row.auto_public_eligible)
          || Boolean(row.claimed_workspace_id)
          || Boolean(row.deregistration_date)
          || Boolean(row.advertising_blocked)
          || jsonArray(row.ongoing_procedures).length > 0;
        const scbConflictCount = Math.max(0, number(row.scb_conflict_count));
        const shouldReview = unsafe
          || !confidence.officialFactsReady
          || confidence.score < 95
          || scbConflictCount > 0;

        revalidated += 1;
        if (!shouldReview) {
          keptPublished += 1;
          continue;
        }

        const moved = await movePublishedProfileToReview({
          profileId,
          profileUpdatedToken,
          factsLastSyncedToken,
          factsSourcePayloadHash,
          scbSourcePayloadHash,
        });
        if (!moved) {
          deferred += 1;
          continue;
        }

        movedToReview += 1;
        if (reviewMessages.length < 5) {
          reviewMessages.push(
            `${organizationNumber}: review (score ${confidence.score}, conflicts ${scbConflictCount}, unsafe ${unsafe ? "yes" : "no"})`,
          );
        }
      } catch (error) {
        errors += 1;
        if (errorMessages.length < 5) {
          errorMessages.push(
            `${organizationNumber}: ${error instanceof Error ? error.message : "Unknown published revalidation error"}`,
          );
        }
      }
    }

    const errorSummary = errorMessages.join(" | ");
    await finishRun({
      runId,
      selected: candidates.length,
      revalidated,
      keptPublished,
      movedToReview,
      errors,
      errorSummary,
    });

    return {
      skipped: false,
      reason: "",
      selected: candidates.length,
      revalidated,
      keptPublished,
      movedToReview,
      deferred,
      errors,
      errorSummary,
      reviewSummary: reviewMessages.join(" | "),
      remaining: await backlogCount(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Published revalidation failed";
    await finishRun({
      runId,
      selected: candidates.length,
      revalidated,
      keptPublished,
      movedToReview,
      errors: errors + 1,
      errorSummary: message,
      failed: true,
    });
    throw error;
  }
}
