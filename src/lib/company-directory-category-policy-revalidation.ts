import "server-only";

import {
  assessCompanyDirectoryCategoryConfidence,
  COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION,
} from "@/lib/company-directory-category-confidence";
import { getSql } from "@/lib/db/server";

const DEFAULT_BATCH_SIZE = 10;
const MAX_BATCH_SIZE = 20;
const FULL_REVALIDATION_HEADROOM_MS = 35_000;

type RevalidationOptions = {
  deadlineAt?: number;
};

type PolicyCandidate = {
  id?: unknown;
  organization_number?: unknown;
  publication_status?: unknown;
  category_slug?: unknown;
  primary_sni_code?: unknown;
  legal_name?: unknown;
  display_name?: unknown;
  activity_description?: unknown;
  is_active?: unknown;
  privacy_blocked?: unknown;
  auto_public_eligible?: unknown;
  profile_updated_token?: unknown;
  registered_names?: unknown;
  sni_codes?: unknown;
  deregistration_date?: unknown;
  advertising_blocked?: unknown;
  ongoing_procedures?: unknown;
  facts_last_synced_token?: unknown;
  facts_source_payload_hash?: unknown;
  scb_source_payload_hash?: unknown;
  scb_conflict_count?: unknown;
  policy_backlog_count?: unknown;
};

class PolicyDeadlineError extends Error {
  constructor() {
    super("Category policy revalidation deadline reached");
    this.name = "AbortError";
  }
}

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
  if (!Number.isFinite(parsed)) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(parsed)));
}

function deadlineReached(deadlineAt?: number) {
  return Number.isFinite(deadlineAt)
    && Date.now() + FULL_REVALIDATION_HEADROOM_MS >= Number(deadlineAt);
}

function createDeadlineSignal(deadlineAt?: number) {
  if (!Number.isFinite(deadlineAt)) {
    return {
      signal: undefined as AbortSignal | undefined,
      cleanup: () => undefined,
    };
  }

  const controller = new AbortController();
  const abortInMs = Number(deadlineAt) - FULL_REVALIDATION_HEADROOM_MS - Date.now();
  if (abortInMs <= 0) {
    controller.abort(new PolicyDeadlineError());
    return {
      signal: controller.signal,
      cleanup: () => undefined,
    };
  }

  const timeout = setTimeout(() => controller.abort(new PolicyDeadlineError()), abortInMs);
  timeout.unref?.();
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timeout),
  };
}

function deadlineAborted(error: unknown, signal?: AbortSignal) {
  return Boolean(signal?.aborted)
    || (error instanceof Error && error.name === "AbortError");
}

function sqlWithDeadline(signal?: AbortSignal) {
  return getSql(signal ? { signal } : undefined);
}

async function loadCandidates(limit: number, signal?: AbortSignal): Promise<PolicyCandidate[]> {
  if (signal?.aborted) throw new PolicyDeadlineError();
  const sql = sqlWithDeadline(signal);
  if (!sql) throw new Error("Database is not configured");

  return await sql`
    select
      profile.id::text,
      profile.organization_number,
      profile.publication_status,
      profile.category_slug,
      profile.primary_sni_code,
      profile.legal_name,
      profile.display_name,
      profile.activity_description,
      profile.is_active,
      profile.privacy_blocked,
      profile.auto_public_eligible,
      profile.updated_at::text as profile_updated_token,
      facts.registered_names,
      facts.sni_codes,
      facts.deregistration_date,
      facts.advertising_blocked,
      facts.ongoing_procedures,
      facts.last_synced_at::text as facts_last_synced_token,
      facts.source_payload_hash as facts_source_payload_hash,
      scb.source_payload_hash as scb_source_payload_hash,
      case when jsonb_typeof(scb.conflicts) = 'array' then jsonb_array_length(scb.conflicts) else 0 end::int as scb_conflict_count,
      count(*) over()::int as policy_backlog_count
    from company_directory_profiles profile
    join company_directory_official_facts facts on facts.profile_id = profile.id
    join company_directory_scb_enrichment scb on scb.profile_id = profile.id
    where profile.country_code = 'SE'
      and profile.organization_kind = 'juridical_person'
      and profile.publication_status in ('published', 'ready')
      and profile.claimed_workspace_id is null
      and length(regexp_replace(profile.organization_number, '\\D', '', 'g')) = 10
      and facts.last_synced_at >= profile.last_synced_at
      and facts.source_payload_hash <> ''
      and scb.source_payload_hash <> ''
      and scb.last_synced_at >= now() - interval '7 days'
      and scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = profile.updated_at::text
      and scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = facts.last_synced_at::text
      and scb.provenance #>> '{categoryConfidencePolicy,version}'
        is distinct from ${COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION}
    order by
      coalesce(
        (scb.provenance #>> '{categoryConfidencePolicyLastAttemptAt}')::timestamptz,
        '-infinity'::timestamptz
      ) asc,
      case profile.publication_status when 'published' then 0 else 1 end,
      regexp_replace(profile.organization_number, '\\D', '', 'g') asc
    limit ${limit}
  ` as PolicyCandidate[];
}

async function markPolicyAttempt(input: {
  profileId: string;
  status: string;
  profileUpdatedToken: string;
  factsLastSyncedToken: string;
  factsSourcePayloadHash: string;
  scbSourcePayloadHash: string;
}, signal?: AbortSignal) {
  if (signal?.aborted) throw new PolicyDeadlineError();
  const sql = sqlWithDeadline(signal);
  if (!sql) return false;

  const rows = await sql`
    update company_directory_scb_enrichment scb
    set provenance = jsonb_set(
          coalesce(scb.provenance, '{}'::jsonb),
          '{categoryConfidencePolicyLastAttemptAt}',
          to_jsonb(now()::text),
          true
        ),
        updated_at = now()
    where scb.profile_id = ${input.profileId}::uuid
      and scb.source_payload_hash = ${input.scbSourcePayloadHash}
      and scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = ${input.profileUpdatedToken}
      and scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = ${input.factsLastSyncedToken}
      and scb.provenance #>> '{categoryConfidencePolicy,version}'
        is distinct from ${COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION}
      and exists (
        select 1
        from company_directory_profiles profile
        where profile.id = scb.profile_id
          and profile.publication_status = ${input.status}
          and profile.updated_at::text = ${input.profileUpdatedToken}
          and profile.claimed_workspace_id is null
      )
      and exists (
        select 1
        from company_directory_official_facts facts
        where facts.profile_id = scb.profile_id
          and facts.last_synced_at::text = ${input.factsLastSyncedToken}
          and facts.source_payload_hash = ${input.factsSourcePayloadHash}
      )
    returning scb.profile_id::text
  `;

  return Boolean(rows[0]);
}

async function markPolicyEvaluation(input: {
  profileId: string;
  status: string;
  profileUpdatedToken: string;
  factsLastSyncedToken: string;
  factsSourcePayloadHash: string;
  scbSourcePayloadHash: string;
}, signal?: AbortSignal) {
  if (signal?.aborted) throw new PolicyDeadlineError();
  const sql = sqlWithDeadline(signal);
  if (!sql) return false;

  const rows = await sql`
    update company_directory_scb_enrichment scb
    set provenance = jsonb_set(
          coalesce(scb.provenance, '{}'::jsonb),
          '{categoryConfidencePolicy}',
          jsonb_build_object(
            'version', ${COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION}::text,
            'profileUpdatedToken', ${input.profileUpdatedToken}::text,
            'officialFactsLastSyncedToken', ${input.factsLastSyncedToken}::text,
            'officialFactsSourcePayloadHash', ${input.factsSourcePayloadHash}::text
          ),
          true
        ),
        updated_at = now()
    where scb.profile_id = ${input.profileId}::uuid
      and scb.source_payload_hash = ${input.scbSourcePayloadHash}
      and scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = ${input.profileUpdatedToken}
      and scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = ${input.factsLastSyncedToken}
      and scb.provenance #>> '{categoryConfidencePolicy,version}'
        is distinct from ${COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION}
      and exists (
        select 1
        from company_directory_profiles profile
        where profile.id = scb.profile_id
          and profile.publication_status = ${input.status}
          and profile.updated_at::text = ${input.profileUpdatedToken}
          and profile.claimed_workspace_id is null
      )
      and exists (
        select 1
        from company_directory_official_facts facts
        where facts.profile_id = scb.profile_id
          and facts.last_synced_at::text = ${input.factsLastSyncedToken}
          and facts.source_payload_hash = ${input.factsSourcePayloadHash}
      )
    returning scb.profile_id::text
  `;

  return Boolean(rows[0]);
}

async function moveEvaluatedProfileToReview(input: {
  profileId: string;
  status: string;
  profileUpdatedToken: string;
  factsLastSyncedToken: string;
  factsSourcePayloadHash: string;
  scbSourcePayloadHash: string;
}, signal?: AbortSignal) {
  if (signal?.aborted) throw new PolicyDeadlineError();
  const sql = sqlWithDeadline(signal);
  if (!sql) return false;

  const rows = await sql`
    with moved_profile as (
      update company_directory_profiles profile
      set publication_status = 'review',
          published_at = null,
          updated_at = now()
      where profile.id = ${input.profileId}::uuid
        and profile.publication_status = ${input.status}
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
        and exists (
          select 1
          from company_directory_scb_enrichment scb
          where scb.profile_id = profile.id
            and scb.source_payload_hash = ${input.scbSourcePayloadHash}
            and scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = ${input.profileUpdatedToken}
            and scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = ${input.factsLastSyncedToken}
            and scb.provenance #>> '{categoryConfidencePolicy,version}'
              is distinct from ${COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION}
        )
      returning profile.id, profile.updated_at::text as resulting_profile_updated_token
    )
    update company_directory_scb_enrichment scb
    set provenance = jsonb_set(
          coalesce(scb.provenance, '{}'::jsonb),
          '{categoryConfidencePolicy}',
          jsonb_build_object(
            'version', ${COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION}::text,
            'profileUpdatedToken', ${input.profileUpdatedToken}::text,
            'resultingProfileUpdatedToken', moved_profile.resulting_profile_updated_token,
            'officialFactsLastSyncedToken', ${input.factsLastSyncedToken}::text,
            'officialFactsSourcePayloadHash', ${input.factsSourcePayloadHash}::text,
            'decision', 'review'
          ),
          true
        ),
        updated_at = now()
    from moved_profile
    where scb.profile_id = moved_profile.id
      and scb.source_payload_hash = ${input.scbSourcePayloadHash}
      and scb.provenance #>> '{comparisonSnapshot,profileUpdatedToken}' = ${input.profileUpdatedToken}
      and scb.provenance #>> '{comparisonSnapshot,officialFactsLastSyncedToken}' = ${input.factsLastSyncedToken}
      and scb.provenance #>> '{categoryConfidencePolicy,version}'
        is distinct from ${COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION}
    returning scb.profile_id::text
  `;

  return Boolean(rows[0]);
}

function deferredBeforeSelection(limit: number) {
  return {
    policyVersion: COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION,
    selected: 0,
    evaluated: 0,
    kept: 0,
    movedToReview: 0,
    deferred: limit,
    errors: 0,
    errorSummary: "",
    remaining: null as number | null,
    reason: undefined as string | undefined,
  };
}

export async function revalidateCompanyDirectoryCategoryPolicyBatch(
  limit?: number,
  options: RevalidationOptions = {},
) {
  const safeLimit = boundedLimit(limit);
  const deadline = createDeadlineSignal(options.deadlineAt);

  if (deadline.signal?.aborted || deadlineReached(options.deadlineAt)) {
    deadline.cleanup();
    return deferredBeforeSelection(safeLimit);
  }

  let candidates: PolicyCandidate[];
  try {
    candidates = await loadCandidates(safeLimit, deadline.signal);
  } catch (error) {
    deadline.cleanup();
    if (deadlineAborted(error, deadline.signal)) {
      return deferredBeforeSelection(safeLimit);
    }
    throw error;
  }

  const initialBacklog = Math.max(0, number(candidates[0]?.policy_backlog_count));
  let evaluated = 0;
  let kept = 0;
  let movedToReview = 0;
  let deferred = 0;
  let errors = 0;
  const errorMessages: string[] = [];

  try {
    for (let index = 0; index < candidates.length; index += 1) {
      if (deadline.signal?.aborted || deadlineReached(options.deadlineAt)) {
        deferred += candidates.length - index;
        break;
      }

      const candidate = candidates[index];
      const profileId = text(candidate.id);
      const organizationNumber = text(candidate.organization_number).replace(/\D/g, "");
      const status = text(candidate.publication_status);
      const profileUpdatedToken = text(candidate.profile_updated_token);
      const factsLastSyncedToken = text(candidate.facts_last_synced_token);
      const factsSourcePayloadHash = text(candidate.facts_source_payload_hash);
      const scbSourcePayloadHash = text(candidate.scb_source_payload_hash);

      if (
        !profileId
        || organizationNumber.length !== 10
        || (status !== "published" && status !== "ready")
        || !profileUpdatedToken
        || !factsLastSyncedToken
        || !factsSourcePayloadHash
        || !scbSourcePayloadHash
      ) {
        errors += 1;
        if (errorMessages.length < 5) errorMessages.push("Category policy candidate is invalid");
        continue;
      }

      try {
        const attempted = await markPolicyAttempt({
          profileId,
          status,
          profileUpdatedToken,
          factsLastSyncedToken,
          factsSourcePayloadHash,
          scbSourcePayloadHash,
        }, deadline.signal);
        if (!attempted) {
          deferred += 1;
          continue;
        }

        const confidence = assessCompanyDirectoryCategoryConfidence({
          categorySlug: text(candidate.category_slug),
          primarySniCode: text(candidate.primary_sni_code),
          legalName: text(candidate.legal_name),
          displayName: text(candidate.display_name),
          activityDescription: text(candidate.activity_description),
          registeredNames: candidate.registered_names,
          sniCodes: candidate.sni_codes,
        });

        const unsafe = !Boolean(candidate.is_active)
          || Boolean(candidate.privacy_blocked)
          || !Boolean(candidate.auto_public_eligible)
          || Boolean(candidate.deregistration_date)
          || Boolean(candidate.advertising_blocked)
          || jsonArray(candidate.ongoing_procedures).length > 0;
        const shouldReview = unsafe
          || !confidence.officialFactsReady
          || confidence.score < 95
          || Math.max(0, number(candidate.scb_conflict_count)) > 0;

        if (shouldReview) {
          const moved = await moveEvaluatedProfileToReview({
            profileId,
            status,
            profileUpdatedToken,
            factsLastSyncedToken,
            factsSourcePayloadHash,
            scbSourcePayloadHash,
          }, deadline.signal);
          if (!moved) {
            deferred += 1;
            continue;
          }

          evaluated += 1;
          movedToReview += 1;
          continue;
        }

        const marked = await markPolicyEvaluation({
          profileId,
          status,
          profileUpdatedToken,
          factsLastSyncedToken,
          factsSourcePayloadHash,
          scbSourcePayloadHash,
        }, deadline.signal);
        if (!marked) {
          deferred += 1;
          continue;
        }

        evaluated += 1;
        kept += 1;
      } catch (error) {
        if (deadlineAborted(error, deadline.signal)) {
          deferred += candidates.length - index;
          break;
        }
        errors += 1;
        if (errorMessages.length < 5) {
          errorMessages.push(
            `${organizationNumber}: ${error instanceof Error ? error.message : "Unknown category policy revalidation error"}`,
          );
        }
      }
    }
  } finally {
    deadline.cleanup();
  }

  return {
    policyVersion: COMPANY_DIRECTORY_CATEGORY_CONFIDENCE_POLICY_VERSION,
    selected: candidates.length,
    evaluated,
    kept,
    movedToReview,
    deferred,
    errors,
    errorSummary: errorMessages.join(" | "),
    remaining: Math.max(0, initialBacklog - evaluated),
    reason: undefined as string | undefined,
  };
}
