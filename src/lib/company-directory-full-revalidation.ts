import "server-only";

import { assessCompanyDirectoryCategoryConfidence } from "@/lib/company-directory-category-confidence";
import { enrichCompanyDirectoryOfficialFactsForProfile } from "@/lib/company-directory-official-facts";
import { enrichCompanyDirectoryScbForProfile } from "@/lib/company-directory-scb-enrichment";
import { createScbCompanyRegistryTransportFromEnv } from "@/lib/company-directory-scb-transport";
import { getSql } from "@/lib/db/server";

const REVALIDATION_PROVIDER = "full_directory_revalidation";
const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 10;
const OFFICIAL_FACTS_START_HEADROOM_MS = 30_000;
const SCB_START_HEADROOM_MS = 18_000;
const DETERMINISTIC_SCB_MATCH_ERROR = "SCB company registry response must contain exactly one matching company";
const DETERMINISTIC_SCB_FAILURE_CODE = "company_match_count";

type RevalidationOptions = {
  deadlineAt?: number;
};

type RevalidationCursor = {
  statusRank: number;
  organizationNumber: string;
};

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

function deterministicScbMatchFailure(error: unknown) {
  return error instanceof Error && error.message === DETERMINISTIC_SCB_MATCH_ERROR;
}

function boundedLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(parsed)));
}

function deadlineReached(deadlineAt?: number, headroomMs = 0) {
  return Number.isFinite(deadlineAt)
    && Date.now() + Math.max(0, headroomMs) >= Number(deadlineAt);
}

function publicationStatusRank(value: unknown) {
  switch (text(value)) {
    case "published": return 0;
    case "ready": return 1;
    case "review": return 2;
    case "inactive": return 3;
    case "claimed": return 4;
    default: return 5;
  }
}

function parseCursor(value: unknown): RevalidationCursor {
  const match = text(value).match(/^([0-4]):(\d{10})$/);
  if (!match) return { statusRank: -1, organizationNumber: "" };
  return {
    statusRank: Number(match[1]),
    organizationNumber: match[2],
  };
}

function serializeCursor(status: unknown, organizationNumber: string) {
  return `${publicationStatusRank(status)}:${organizationNumber}`;
}

async function startRun() {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  await sql`
    update company_directory_sync_runs
    set status = 'failed',
        error_count = greatest(error_count, 1),
        error_summary = case
          when error_summary = '' then 'stale full Directory revalidation lease recovered automatically'
          else error_summary
        end,
        completed_at = now()
    where provider = ${REVALIDATION_PROVIDER}
      and status = 'running'
      and started_at < now() - interval '10 minutes'
  `;

  const rows = await sql`
    insert into company_directory_sync_runs (provider, status, cursor_value)
    values (
      ${REVALIDATION_PROVIDER},
      'running',
      coalesce((
        select previous.cursor_value
        from company_directory_sync_runs previous
        where previous.provider = ${REVALIDATION_PROVIDER}
          and previous.status <> 'running'
        order by previous.started_at desc
        limit 1
      ), '')
    )
    on conflict do nothing
    returning id::text, cursor_value
  `;

  const runId = text(rows[0]?.id);
  return runId
    ? { runId, cursorValue: text(rows[0]?.cursor_value) }
    : null;
}

async function finishRun(input: {
  runId: string;
  cursorValue: string;
  selected: number;
  refreshed: number;
  kept: number;
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
        cursor_value = ${input.cursorValue},
        scanned_count = ${input.selected},
        upserted_count = ${input.refreshed},
        published_count = ${input.kept},
        blocked_count = ${input.movedToReview},
        error_count = ${input.errors},
        error_summary = ${input.errorSummary},
        completed_at = now()
    where id = ${input.runId}::uuid
  `;
}

async function selectCandidates(limit: number, cursorValue: string) {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");
  const cursor = parseCursor(cursorValue);

  return await sql`
    with eligible as (
      select
        profile.id::text,
        profile.organization_number,
        profile.display_name,
        profile.publication_status,
        regexp_replace(profile.organization_number, '\\D', '', 'g') as normalized_organization_number,
        case profile.publication_status
          when 'published' then 0
          when 'ready' then 1
          when 'review' then 2
          when 'inactive' then 3
          when 'claimed' then 4
          else 5
        end as status_rank,
        (
          profile.publication_status in ('published', 'ready')
          and profile.claimed_workspace_id is null
          and facts.profile_id is not null
          and facts.source_payload_hash <> ''
          and facts.last_synced_at >= profile.last_synced_at
          and (
            facts.deregistration_date is not null
            or coalesce(facts.advertising_blocked, false) = true
            or jsonb_array_length(coalesce(facts.ongoing_procedures, '[]'::jsonb)) > 0
          )
        ) as known_hard_official_facts_block
      from company_directory_profiles profile
      left join company_directory_official_facts facts on facts.profile_id = profile.id
      left join company_directory_scb_enrichment scb on scb.profile_id = profile.id
      where profile.country_code = 'SE'
        and profile.organization_kind = 'juridical_person'
        and profile.publication_status in ('published', 'ready', 'review', 'inactive', 'claimed')
        and length(regexp_replace(profile.organization_number, '\\D', '', 'g')) = 10
        and (
          facts.profile_id is null
          or facts.source_payload_hash = ''
          or facts.last_synced_at < profile.last_synced_at
          or (
            profile.publication_status <> 'inactive'
            and not (
              profile.publication_status = 'review'
              and facts.profile_id is not null
              and facts.source_payload_hash <> ''
              and facts.last_synced_at >= profile.last_synced_at
              and (
                facts.deregistration_date is not null
                or coalesce(facts.advertising_blocked, false) = true
                or jsonb_array_length(coalesce(facts.ongoing_procedures, '[]'::jsonb)) > 0
              )
            )
            and not coalesce((
              scb.provenance #>> '{revalidationFailure,code}' = ${DETERMINISTIC_SCB_FAILURE_CODE}
              and scb.provenance #>> '{revalidationFailure,profileUpdatedToken}' = profile.updated_at::text
              and scb.provenance #>> '{revalidationFailure,officialFactsLastSyncedToken}' = facts.last_synced_at::text
              and scb.updated_at >= now() - interval '24 hours'
            ), false)
            and (
              scb.profile_id is null
              or scb.source_payload_hash = ''
              or scb.last_synced_at < now() - interval '7 days'
              or scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' is distinct from profile.updated_at::text
              or scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' is distinct from facts.last_synced_at::text
              or (
                profile.publication_status = 'review'
                and profile.is_active = true
                and profile.privacy_blocked = false
                and profile.auto_public_eligible = true
                and profile.claimed_workspace_id is null
                and not exists (
                  select 1
                  from company_directory_discovery_queue queue
                  where queue.state = 'failed'
                    and (
                      queue.profile_id = profile.id
                      or (
                        queue.country_code = profile.country_code
                        and queue.organization_number = regexp_replace(profile.organization_number, '\\D', '', 'g')
                      )
                    )
                )
                and facts.profile_id is not null
                and facts.source_payload_hash <> ''
                and facts.last_synced_at >= profile.last_synced_at
                and facts.deregistration_date is null
                and coalesce(facts.advertising_blocked, false) = false
                and jsonb_array_length(coalesce(facts.ongoing_procedures, '[]'::jsonb)) = 0
                and scb.profile_id is not null
                and scb.source_payload_hash <> ''
                and scb.last_synced_at >= now() - interval '7 days'
                and jsonb_array_length(coalesce(scb.conflicts, '[]'::jsonb)) = 0
                and scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = profile.updated_at::text
                and scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = facts.last_synced_at::text
                and (
                  scb.provenance #>> '{reviewRecoveryEvaluation,profileUpdatedToken}' is distinct from profile.updated_at::text
                  or scb.provenance #>> '{reviewRecoveryEvaluation,officialFactsLastSyncedToken}' is distinct from facts.last_synced_at::text
                  or scb.provenance #>> '{reviewRecoveryEvaluation,officialFactsSourcePayloadHash}' is distinct from facts.source_payload_hash
                )
              )
            )
          )
        )
    )
    select id, organization_number, display_name, publication_status,
           normalized_organization_number, status_rank, known_hard_official_facts_block
    from eligible
    order by
      case when status_rank = 0 then 0 else 1 end,
      case when (
        status_rank > ${cursor.statusRank}
        or (status_rank = ${cursor.statusRank} and normalized_organization_number > ${cursor.organizationNumber})
      ) then 0 else 1 end,
      status_rank,
      normalized_organization_number
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
    where profile.country_code = 'SE'
      and profile.organization_kind = 'juridical_person'
      and profile.publication_status in ('published', 'ready', 'review', 'inactive', 'claimed')
      and length(regexp_replace(profile.organization_number, '\\D', '', 'g')) = 10
      and (
        facts.profile_id is null
        or facts.source_payload_hash = ''
        or facts.last_synced_at < profile.last_synced_at
        or (
          profile.publication_status <> 'inactive'
          and not (
            profile.publication_status = 'review'
            and facts.profile_id is not null
            and facts.source_payload_hash <> ''
            and facts.last_synced_at >= profile.last_synced_at
            and (
              facts.deregistration_date is not null
              or coalesce(facts.advertising_blocked, false) = true
              or jsonb_array_length(coalesce(facts.ongoing_procedures, '[]'::jsonb)) > 0
            )
          )
          and not coalesce((
            scb.provenance #>> '{revalidationFailure,code}' = ${DETERMINISTIC_SCB_FAILURE_CODE}
            and scb.provenance #>> '{revalidationFailure,profileUpdatedToken}' = profile.updated_at::text
            and scb.provenance #>> '{revalidationFailure,officialFactsLastSyncedToken}' = facts.last_synced_at::text
            and scb.updated_at >= now() - interval '24 hours'
          ), false)
          and (
            scb.profile_id is null
            or scb.source_payload_hash = ''
            or scb.last_synced_at < now() - interval '7 days'
            or scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' is distinct from profile.updated_at::text
            or scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' is distinct from facts.last_synced_at::text
            or (
              profile.publication_status = 'review'
              and profile.is_active = true
              and profile.privacy_blocked = false
              and profile.auto_public_eligible = true
              and profile.claimed_workspace_id is null
              and not exists (
                select 1
                from company_directory_discovery_queue queue
                where queue.state = 'failed'
                  and (
                    queue.profile_id = profile.id
                    or (
                      queue.country_code = profile.country_code
                      and queue.organization_number = regexp_replace(profile.organization_number, '\\D', '', 'g')
                    )
                  )
              )
              and facts.profile_id is not null
              and facts.source_payload_hash <> ''
              and facts.last_synced_at >= profile.last_synced_at
              and facts.deregistration_date is null
              and coalesce(facts.advertising_blocked, false) = false
              and jsonb_array_length(coalesce(facts.ongoing_procedures, '[]'::jsonb)) = 0
              and scb.profile_id is not null
              and scb.source_payload_hash <> ''
              and scb.last_synced_at >= now() - interval '7 days'
              and jsonb_array_length(coalesce(scb.conflicts, '[]'::jsonb)) = 0
              and scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = profile.updated_at::text
              and scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = facts.last_synced_at::text
              and (
                scb.provenance #>> '{reviewRecoveryEvaluation,profileUpdatedToken}' is distinct from profile.updated_at::text
                or scb.provenance #>> '{reviewRecoveryEvaluation,officialFactsLastSyncedToken}' is distinct from facts.last_synced_at::text
                or scb.provenance #>> '{reviewRecoveryEvaluation,officialFactsSourcePayloadHash}' is distinct from facts.source_payload_hash
              )
            )
          )
        )
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
        and scb.last_synced_at >= now() - interval '7 days'
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

async function markScbEvaluationPending(profileId: string) {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  await sql`
    update company_directory_scb_enrichment
    set provenance = coalesce(provenance, '{}'::jsonb) #- '{comparisonSnapshot,officialFactsLastSyncedToken}',
        updated_at = now()
    where profile_id = ${profileId}::uuid
  `;
}

async function markReviewRecoveryEvaluation(input: {
  profileId: string;
  profileUpdatedToken: string;
  factsLastSyncedToken: string;
  factsSourcePayloadHash: string;
}) {
  const sql = getSql();
  if (!sql) return false;

  const rows = await sql`
    update company_directory_scb_enrichment scb
    set provenance = jsonb_set(
          coalesce(scb.provenance, '{}'::jsonb),
          '{reviewRecoveryEvaluation}',
          jsonb_build_object(
            'profileUpdatedToken', ${input.profileUpdatedToken}::text,
            'officialFactsLastSyncedToken', ${input.factsLastSyncedToken}::text,
            'officialFactsSourcePayloadHash', ${input.factsSourcePayloadHash}::text
          ),
          true
        ),
        updated_at = now()
    where scb.profile_id = ${input.profileId}::uuid
      and exists (
        select 1
        from company_directory_profiles profile
        join company_directory_official_facts facts on facts.profile_id = profile.id
        where profile.id = scb.profile_id
          and profile.publication_status = 'review'
          and profile.updated_at::text = ${input.profileUpdatedToken}
          and facts.last_synced_at::text = ${input.factsLastSyncedToken}
          and facts.source_payload_hash = ${input.factsSourcePayloadHash}
      )
    returning scb.profile_id::text
  `;

  return Boolean(rows[0]);
}

async function moveKnownHardBlockedProfileToReview(profileId: string, expectedStatus: string) {
  const sql = getSql();
  if (!sql) return false;

  const rows = await sql`
    update company_directory_profiles profile
    set publication_status = 'review',
        published_at = null,
        updated_at = now()
    where profile.id = ${profileId}::uuid
      and profile.publication_status = ${expectedStatus}
      and profile.country_code = 'SE'
      and profile.organization_kind = 'juridical_person'
      and profile.claimed_workspace_id is null
      and exists (
        select 1
        from company_directory_official_facts facts
        where facts.profile_id = profile.id
          and facts.source_payload_hash <> ''
          and facts.last_synced_at >= profile.last_synced_at
          and (
            facts.deregistration_date is not null
            or coalesce(facts.advertising_blocked, false) = true
            or jsonb_array_length(coalesce(facts.ongoing_procedures, '[]'::jsonb)) > 0
          )
      )
    returning profile.id::text
  `;

  return Boolean(rows[0]);
}

async function moveProfileToReviewAfterScbFailure(input: {
  profileId: string;
  expectedStatus: string;
  profileUpdatedToken: string;
  factsLastSyncedToken: string;
  factsSourcePayloadHash: string;
}) {
  const sql = getSql();
  if (!sql) return false;

  const rows = await sql`
    update company_directory_profiles profile
    set publication_status = 'review',
        published_at = null,
        updated_at = now()
    where profile.id = ${input.profileId}::uuid
      and profile.publication_status = ${input.expectedStatus}
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
    returning profile.id::text
  `;

  return Boolean(rows[0]);
}

async function recordDeterministicScbFailure(input: {
  profileId: string;
  factsLastSyncedToken: string;
}) {
  const sql = getSql();
  if (!sql) return false;

  const rows = await sql`
    insert into company_directory_scb_enrichment (
      profile_id,
      organization_number,
      provenance,
      source_payload_hash,
      updated_at
    )
    select
      profile.id,
      regexp_replace(profile.organization_number, '\\D', '', 'g'),
      jsonb_build_object(
        'revalidationFailure',
        jsonb_build_object(
          'code', ${DETERMINISTIC_SCB_FAILURE_CODE}::text,
          'profileUpdatedToken', profile.updated_at::text,
          'officialFactsLastSyncedToken', facts.last_synced_at::text
        )
      ),
      '',
      now()
    from company_directory_profiles profile
    join company_directory_official_facts facts on facts.profile_id = profile.id
    where profile.id = ${input.profileId}::uuid
      and facts.last_synced_at::text = ${input.factsLastSyncedToken}
    on conflict (profile_id) do update set
      provenance = jsonb_set(
        coalesce(company_directory_scb_enrichment.provenance, '{}'::jsonb),
        '{revalidationFailure}',
        excluded.provenance -> 'revalidationFailure',
        true
      ),
      updated_at = now()
    returning profile_id::text
  `;

  return Boolean(rows[0]);
}

async function moveProfileToReview(input: {
  profileId: string;
  expectedStatus: string;
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
      and profile.publication_status = ${input.expectedStatus}
      and profile.country_code = 'SE'
      and profile.organization_kind = 'juridical_person'
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

async function restoreUnsafeRecoveredProfileToReview(input: {
  profileId: string;
  profileUpdatedToken: string;
  factsLastSyncedToken: string;
  factsSourcePayloadHash: string;
}) {
  const sql = getSql();
  if (!sql) return false;

  const rows = await sql`
    update company_directory_profiles profile
    set publication_status = 'review',
        published_at = null,
        updated_at = now()
    where profile.id = ${input.profileId}::uuid
      and profile.publication_status = 'ready'
      and profile.updated_at::text = ${input.profileUpdatedToken}
      and profile.country_code = 'SE'
      and profile.organization_kind = 'juridical_person'
      and profile.claimed_workspace_id is null
      and exists (
        select 1
        from company_directory_official_facts facts
        where facts.profile_id = profile.id
          and facts.last_synced_at::text = ${input.factsLastSyncedToken}
          and facts.source_payload_hash = ${input.factsSourcePayloadHash}
      )
    returning profile.id::text
  `;

  return Boolean(rows[0]);
}

async function restoreSafeReviewProfileToReady(input: {
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
    set publication_status = 'ready',
        published_at = null,
        updated_at = now()
    where profile.id = ${input.profileId}::uuid
      and profile.publication_status = 'review'
      and profile.country_code = 'SE'
      and profile.organization_kind = 'juridical_person'
      and profile.is_active = true
      and profile.privacy_blocked = false
      and profile.auto_public_eligible = true
      and profile.claimed_workspace_id is null
      and profile.updated_at::text = ${input.profileUpdatedToken}
      and not exists (
        select 1
        from company_directory_discovery_queue queue
        where queue.state = 'failed'
          and (
            queue.profile_id = profile.id
            or (
              queue.country_code = profile.country_code
              and queue.organization_number = regexp_replace(profile.organization_number, '\\D', '', 'g')
            )
          )
      )
      and exists (
        select 1
        from company_directory_official_facts facts
        where facts.profile_id = profile.id
          and facts.last_synced_at::text = ${input.factsLastSyncedToken}
          and facts.last_synced_at >= profile.last_synced_at
          and facts.source_payload_hash = ${input.factsSourcePayloadHash}
          and facts.deregistration_date is null
          and coalesce(facts.advertising_blocked, false) = false
          and jsonb_array_length(coalesce(facts.ongoing_procedures, '[]'::jsonb)) = 0
      )
      and exists (
        select 1
        from company_directory_scb_enrichment scb
        where scb.profile_id = profile.id
          and scb.source_payload_hash = ${input.scbSourcePayloadHash}
          and scb.last_synced_at >= now() - interval '7 days'
          and jsonb_array_length(coalesce(scb.conflicts, '[]'::jsonb)) = 0
          and scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = profile.updated_at::text
          and scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = ${input.factsLastSyncedToken}
      )
    returning profile.updated_at::text as profile_updated_token
  `;

  return text(rows[0]?.profile_updated_token);
}

export async function revalidateAllCompanyDirectoryBatch(
  limit?: number,
  options: RevalidationOptions = {},
) {
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
      refreshed: 0,
      kept: 0,
      movedToReview: 0,
      recoveredToReady: 0,
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
      refreshed: 0,
      kept: 0,
      movedToReview: 0,
      recoveredToReady: 0,
      deferred: 0,
      errors: 0,
      errorSummary: "SCB certificate access is not configured in this environment",
      remaining: await backlogCount(),
    };
  }

  const run = await startRun();
  if (!run) {
    return {
      skipped: true,
      reason: "already_running",
      selected: 0,
      refreshed: 0,
      kept: 0,
      movedToReview: 0,
      recoveredToReady: 0,
      deferred: 0,
      errors: 0,
      errorSummary: "",
      remaining: await backlogCount(),
    };
  }

  const { runId } = run;
  let cursorValue = run.cursorValue;
  let candidates: Awaited<ReturnType<typeof selectCandidates>> = [];
  let refreshed = 0;
  let kept = 0;
  let movedToReview = 0;
  let recoveredToReady = 0;
  let deferred = 0;
  let errors = 0;
  const errorMessages: string[] = [];

  try {
    candidates = await selectCandidates(safeLimit, cursorValue);

    candidateLoop:
    for (let index = 0; index < candidates.length; index += 1) {
      if (deadlineReached(options.deadlineAt, OFFICIAL_FACTS_START_HEADROOM_MS)) {
        deferred += candidates.length - index;
        break;
      }

      const candidate = candidates[index];
      const profileId = text(candidate.id);
      const organizationNumber = text(
        candidate.normalized_organization_number ?? candidate.organization_number,
      ).replace(/\D/g, "");
      if (!profileId || organizationNumber.length !== 10) {
        errors += 1;
        if (errorMessages.length < 5) errorMessages.push("Directory revalidation candidate is invalid");
        continue;
      }
      cursorValue = serializeCursor(candidate.publication_status, organizationNumber);

      try {
        const candidateStatus = text(candidate.publication_status);
        if (
          (candidateStatus === "published" || candidateStatus === "ready")
          && Boolean(candidate.known_hard_official_facts_block)
        ) {
          const moved = await moveKnownHardBlockedProfileToReview(profileId, candidateStatus);
          if (moved) {
            movedToReview += 1;
            continue;
          }
        }

        await enrichCompanyDirectoryOfficialFactsForProfile(profileId);
        if (candidateStatus === "inactive") {
          refreshed += 1;
          kept += 1;
          continue;
        }

        if (deadlineReached(options.deadlineAt, SCB_START_HEADROOM_MS)) {
          deferred += candidates.length - index;
          break candidateLoop;
        }

        let scb;
        try {
          scb = await enrichCompanyDirectoryScbForProfile(profileId, transport, {
            allowWhenDisabledWithExplicitTransport: true,
          });
        } catch (error) {
          if (!deterministicScbMatchFailure(error)) throw error;

          const failureEvaluation = await loadFreshEvaluation(profileId);
          if (!failureEvaluation) {
            deferred += 1;
            continue;
          }

          const failureStatus = text(failureEvaluation.publication_status);
          const profileUpdatedToken = text(failureEvaluation.profile_updated_token);
          const factsLastSyncedToken = text(failureEvaluation.facts_last_synced_token);
          const factsSourcePayloadHash = text(failureEvaluation.facts_source_payload_hash);
          if (!profileUpdatedToken || !factsLastSyncedToken || !factsSourcePayloadHash) {
            deferred += 1;
            continue;
          }

          if (failureStatus === "published" || failureStatus === "ready") {
            const moved = await moveProfileToReviewAfterScbFailure({
              profileId,
              expectedStatus: failureStatus,
              profileUpdatedToken,
              factsLastSyncedToken,
              factsSourcePayloadHash,
            });
            if (!moved) {
              deferred += 1;
              continue;
            }
            movedToReview += 1;
          }

          const recorded = await recordDeterministicScbFailure({
            profileId,
            factsLastSyncedToken,
          });
          if (!recorded) {
            deferred += 1;
            continue;
          }

          deferred += 1;
          continue;
        }

        if (scb.status !== "saved") {
          deferred += 1;
          if (errorMessages.length < 5) {
            errorMessages.push(`${organizationNumber}: SCB refresh deferred (${scb.status})`);
          }
          continue;
        }

        if (deadlineReached(options.deadlineAt)) {
          await markScbEvaluationPending(profileId);
          deferred += candidates.length - index;
          break candidateLoop;
        }

        const row = await loadFreshEvaluation(profileId);
        if (!row) {
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

        refreshed += 1;
        const status = text(row.publication_status);
        const claimed = Boolean(row.claimed_workspace_id);
        const unsafe = text(row.country_code) !== "SE"
          || text(row.organization_kind) !== "juridical_person"
          || !Boolean(row.is_active)
          || Boolean(row.privacy_blocked)
          || !Boolean(row.auto_public_eligible)
          || Boolean(row.deregistration_date)
          || Boolean(row.advertising_blocked)
          || jsonArray(row.ongoing_procedures).length > 0;
        const scbConflictCount = Math.max(0, number(row.scb_conflict_count));
        const shouldReview = unsafe
          || !confidence.officialFactsReady
          || confidence.score < 95
          || scbConflictCount > 0;

        if (claimed || status === "inactive") {
          kept += 1;
          continue;
        }

        if (status === "review") {
          if (shouldReview) {
            const reviewRecorded = await markReviewRecoveryEvaluation({
              profileId,
              profileUpdatedToken,
              factsLastSyncedToken,
              factsSourcePayloadHash,
            });
            if (!reviewRecorded) {
              deferred += 1;
              if (errorMessages.length < 5) {
                errorMessages.push(`${organizationNumber}: could not record Review recovery evaluation`);
              }
              continue;
            }
            kept += 1;
            continue;
          }

          if (deadlineReached(options.deadlineAt, SCB_START_HEADROOM_MS)) {
            deferred += candidates.length - index;
            break candidateLoop;
          }

          const recoveryProfileUpdatedToken = await restoreSafeReviewProfileToReady({
            profileId,
            profileUpdatedToken,
            factsLastSyncedToken,
            factsSourcePayloadHash,
            scbSourcePayloadHash,
          });
          if (!recoveryProfileUpdatedToken) {
            deferred += 1;
            continue;
          }

          const finalScb = await enrichCompanyDirectoryScbForProfile(profileId, transport, {
            allowWhenDisabledWithExplicitTransport: true,
          });
          const finalEvaluation = await loadFreshEvaluation(profileId);
          const finalScbSafe = finalScb.status === "saved"
            && Boolean(finalEvaluation?.scb_snapshot_fresh)
            && Math.max(0, number(finalEvaluation?.scb_conflict_count)) === 0;
          if (!finalScbSafe) {
            const reverted = await restoreUnsafeRecoveredProfileToReview({
              profileId,
              profileUpdatedToken: recoveryProfileUpdatedToken,
              factsLastSyncedToken,
              factsSourcePayloadHash,
            });
            deferred += 1;
            if (reverted) kept += 1;
            else errors += 1;
            if (errorMessages.length < 5) {
              errorMessages.push(
                `${organizationNumber}: final SCB evidence unsafe after Review recovery (${finalScb.status}; reverted=${reverted})`,
              );
            }
            continue;
          }

          recoveredToReady += 1;
          continue;
        }

        if (!shouldReview) {
          kept += 1;
          continue;
        }

        if (status !== "published" && status !== "ready") {
          kept += 1;
          continue;
        }

        if (deadlineReached(options.deadlineAt)) {
          await markScbEvaluationPending(profileId);
          deferred += candidates.length - index;
          break candidateLoop;
        }

        const moved = await moveProfileToReview({
          profileId,
          expectedStatus: status,
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

        // The status transition updates profile.updated_at. Refresh SCB once more so
        // the saved provenance matches the final profile token. If the shared cron
        // deadline cannot safely accommodate another SCB request, leave this profile
        // deferred so a later sweep repairs the final snapshot.
        if (deadlineReached(options.deadlineAt, SCB_START_HEADROOM_MS)) {
          deferred += candidates.length - index;
          break candidateLoop;
        }

        const finalScb = await enrichCompanyDirectoryScbForProfile(profileId, transport, {
          allowWhenDisabledWithExplicitTransport: true,
        });
        if (finalScb.status !== "saved") {
          deferred += 1;
          if (errorMessages.length < 5) {
            errorMessages.push(`${organizationNumber}: final SCB snapshot deferred (${finalScb.status})`);
          }
        }
      } catch (error) {
        errors += 1;
        if (errorMessages.length < 5) {
          errorMessages.push(
            `${organizationNumber}: ${error instanceof Error ? error.message : "Unknown Directory revalidation error"}`,
          );
        }
      }
    }

    const errorSummary = errorMessages.join(" | ");
    await finishRun({
      runId,
      cursorValue,
      selected: candidates.length,
      refreshed,
      kept,
      movedToReview,
      errors,
      errorSummary,
    });

    return {
      skipped: false,
      reason: "",
      selected: candidates.length,
      refreshed,
      kept,
      movedToReview,
      recoveredToReady,
      deferred,
      errors,
      errorSummary,
      remaining: await backlogCount(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Full Directory revalidation failed";
    await finishRun({
      runId,
      cursorValue,
      selected: candidates.length,
      refreshed,
      kept,
      movedToReview,
      errors: errors + 1,
      errorSummary: message,
      failed: true,
    });
    throw error;
  }
}
