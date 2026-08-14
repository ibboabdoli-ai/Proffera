import "server-only";

import { getSql } from "@/lib/db/server";
import { autoPublishCompanyDirectoryProfileIfSafe } from "@/lib/company-directory-publication";

const DEFAULT_READY_RESOLUTION_BATCH_SIZE = 20;
const MAX_READY_RESOLUTION_BATCH_SIZE = 20;

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function boundedInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

async function markReadyProfileForReview(profileId: string, queueId: string) {
  const sql = getSql();
  if (!sql) return false;

  const rows = await sql`
    with target as (
      select profile.id as profile_id, queue.id as queue_id
      from company_directory_profiles profile
      join company_directory_discovery_queue queue on queue.profile_id = profile.id
      where profile.id = ${profileId}::uuid
        and queue.id = ${queueId}::uuid
        and profile.publication_status = 'ready'
        and queue.state = 'ready'
      for update of profile, queue
    ),
    profile_update as (
      update company_directory_profiles profile
      set publication_status = 'review',
          updated_at = now()
      from target
      where profile.id = target.profile_id
        and profile.publication_status = 'ready'
      returning profile.id
    )
    update company_directory_discovery_queue queue
    set state = 'review',
        verified_at = now(),
        locked_at = null,
        lock_token = null,
        last_error = '',
        next_attempt_at = now()
    from target
    where queue.id = target.queue_id
      and queue.state = 'ready'
      and exists (
        select 1
        from profile_update
        where profile_update.id = target.profile_id
      )
    returning queue.id::text
  `;

  return Boolean(rows[0]);
}

async function syncPublishedQueueState(profileId: string, queueId: string) {
  const sql = getSql();
  if (!sql) return false;

  const rows = await sql`
    update company_directory_discovery_queue queue
    set state = 'published',
        verified_at = now(),
        locked_at = null,
        lock_token = null,
        last_error = '',
        next_attempt_at = now()
    where queue.id = ${queueId}::uuid
      and queue.profile_id = ${profileId}::uuid
      and queue.state = 'ready'
      and exists (
        select 1
        from company_directory_profiles profile
        where profile.id = ${profileId}::uuid
          and profile.publication_status = 'published'
      )
    returning queue.id::text
  `;

  return Boolean(rows[0]);
}

export async function resolveReadyCompanyDirectoryProfiles(limit?: number) {
  if (process.env.COMPANY_DIRECTORY_AUTO_PUBLISH?.trim().toLowerCase() !== "true") {
    return {
      skipped: true,
      selected: 0,
      published: 0,
      reviewed: 0,
      deferred: 0,
      errors: 0,
      errorSummary: "",
    };
  }

  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  const safeLimit = boundedInteger(
    limit,
    DEFAULT_READY_RESOLUTION_BATCH_SIZE,
    MAX_READY_RESOLUTION_BATCH_SIZE,
  );
  const candidates = await sql`
    select
      queue.id::text as queue_id,
      profile.id::text as profile_id
    from company_directory_discovery_queue queue
    join company_directory_profiles profile on profile.id = queue.profile_id
    join company_directory_official_facts facts on facts.profile_id = profile.id
    where queue.state = 'ready'
      and profile.publication_status = 'ready'
      and facts.last_synced_at >= profile.last_synced_at
      and facts.source_payload_hash <> ''
    order by queue.verified_at asc nulls first, queue.first_seen_at asc, queue.organization_number asc
    limit ${safeLimit}
  `;

  let published = 0;
  let reviewed = 0;
  let deferred = 0;
  let errors = 0;
  const errorMessages: string[] = [];

  for (const candidate of candidates) {
    const profileId = text(candidate.profile_id);
    const queueId = text(candidate.queue_id);
    if (!profileId || !queueId) {
      errors += 1;
      if (errorMessages.length < 8) errorMessages.push("Ready directory candidate is missing an id");
      continue;
    }

    try {
      const publication = await autoPublishCompanyDirectoryProfileIfSafe(profileId);
      if (!publication) {
        deferred += 1;
        continue;
      }

      if (publication.ok) {
        const queueSynced = await syncPublishedQueueState(profileId, queueId);
        if (queueSynced) published += 1;
        else deferred += 1;
        continue;
      }

      if (publication.code === "unsafe" || publication.code === "low_confidence") {
        const movedToReview = await markReadyProfileForReview(profileId, queueId);
        if (movedToReview) reviewed += 1;
        else deferred += 1;
        continue;
      }

      if (publication.code === "not_ready" || publication.code === "not_found") {
        deferred += 1;
        continue;
      }

      errors += 1;
      if (errorMessages.length < 8) {
        errorMessages.push(`${profileId}: ready resolution failed (${publication.code})`);
      }
    } catch (error) {
      errors += 1;
      if (errorMessages.length < 8) {
        errorMessages.push(
          `${profileId}: ${error instanceof Error ? error.message : "Unknown ready resolution error"}`,
        );
      }
    }
  }

  return {
    skipped: false,
    selected: candidates.length,
    published,
    reviewed,
    deferred,
    errors,
    errorSummary: errorMessages.join(" | "),
  };
}
