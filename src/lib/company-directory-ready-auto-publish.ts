import "server-only";

import { assessCompanyDirectoryCategoryConfidence } from "@/lib/company-directory-category-confidence";
import { autoPublishCompanyDirectoryProfileIfSafe } from "@/lib/company-directory-publication";
import { getSql } from "@/lib/db/server";

const DEFAULT_READY_AUTO_PUBLISH_BATCH_SIZE = 10;
const MAX_READY_AUTO_PUBLISH_BATCH_SIZE = 20;
const READY_AUTO_PUBLISH_FAST_SCAN_SIZE = 10;
const READY_AUTO_PUBLISH_SCAN_SIZE = 25;
const READY_AUTO_PUBLISH_ROTATION_MS = 15 * 60 * 1000;

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function boundedInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isHighConfidenceReadyRow(row: Record<string, unknown>) {
  const confidence = assessCompanyDirectoryCategoryConfidence({
    categorySlug: text(row.category_slug),
    primarySniCode: text(row.primary_sni_code),
    legalName: text(row.legal_name),
    displayName: text(row.display_name),
    activityDescription: text(row.activity_description),
    registeredNames: row.registered_names,
    sniCodes: row.sni_codes,
  });

  return confidence.officialFactsReady && confidence.score >= 95;
}

async function syncPublishedQueueState(profileId: string) {
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
    where queue.profile_id = ${profileId}::uuid
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

export async function autoPublishReadyHighConfidenceCompanyDirectoryBatch(limit?: number) {
  if (process.env.COMPANY_DIRECTORY_AUTO_PUBLISH?.trim().toLowerCase() !== "true") {
    return {
      skipped: true,
      safetyEligible: 0,
      scanned: 0,
      highConfidence: 0,
      selected: 0,
      published: 0,
      queueSynced: 0,
      deferred: 0,
      errors: 0,
      errorSummary: "",
    };
  }

  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  const safeLimit = boundedInteger(
    limit,
    DEFAULT_READY_AUTO_PUBLISH_BATCH_SIZE,
    MAX_READY_AUTO_PUBLISH_BATCH_SIZE,
  );

  const countRows = await sql`
    select count(*)::int as count
    from company_directory_profiles profile
    join company_directory_official_facts facts on facts.profile_id = profile.id
    where profile.publication_status = 'ready'
      and profile.is_active = true
      and profile.privacy_blocked = false
      and profile.auto_public_eligible = true
      and profile.claimed_workspace_id is null
      and facts.last_synced_at >= profile.last_synced_at
      and facts.source_payload_hash <> ''
      and facts.deregistration_date is null
      and coalesce(facts.advertising_blocked, false) = false
      and jsonb_array_length(coalesce(facts.ongoing_procedures, '[]'::jsonb)) = 0
  `;
  const safetyEligible = Math.max(0, number(countRows[0]?.count));
  if (!safetyEligible) {
    return {
      skipped: false,
      safetyEligible: 0,
      scanned: 0,
      highConfidence: 0,
      selected: 0,
      published: 0,
      queueSynced: 0,
      deferred: 0,
      errors: 0,
      errorSummary: "",
    };
  }

  // Keep a small fast lane for newly verified Ready companies so they do not wait
  // for the rotating backlog window to revisit their organization-number range.
  // All normal safety and >=95 confidence gates still run before publication.
  const freshRows = await sql`
    select
      profile.id::text,
      profile.category_slug,
      profile.primary_sni_code,
      profile.legal_name,
      profile.display_name,
      profile.activity_description,
      facts.registered_names,
      facts.sni_codes
    from company_directory_discovery_queue queue
    join company_directory_profiles profile on profile.id = queue.profile_id
    join company_directory_official_facts facts on facts.profile_id = profile.id
    where queue.state = 'ready'
      and queue.verified_at is not null
      and profile.publication_status = 'ready'
      and profile.is_active = true
      and profile.privacy_blocked = false
      and profile.auto_public_eligible = true
      and profile.claimed_workspace_id is null
      and facts.last_synced_at >= profile.last_synced_at
      and facts.source_payload_hash <> ''
      and facts.deregistration_date is null
      and coalesce(facts.advertising_blocked, false) = false
      and jsonb_array_length(coalesce(facts.ongoing_procedures, '[]'::jsonb)) = 0
    order by queue.verified_at desc, queue.last_seen_at desc, profile.organization_number asc
    limit ${READY_AUTO_PUBLISH_FAST_SCAN_SIZE}
  `;

  // Confidence uses richer Official Facts JSON. Keep one rotating bounded window per
  // scheduled run so the older Ready backlog remains starvation-free.
  const scanPages = Math.max(1, Math.ceil(safetyEligible / READY_AUTO_PUBLISH_SCAN_SIZE));
  const rotation = Math.floor(Date.now() / READY_AUTO_PUBLISH_ROTATION_MS);
  const scanOffset = (rotation % scanPages) * READY_AUTO_PUBLISH_SCAN_SIZE;

  const backlogRows = await sql`
    select
      profile.id::text,
      profile.category_slug,
      profile.primary_sni_code,
      profile.legal_name,
      profile.display_name,
      profile.activity_description,
      facts.registered_names,
      facts.sni_codes
    from company_directory_profiles profile
    join company_directory_official_facts facts on facts.profile_id = profile.id
    where profile.publication_status = 'ready'
      and profile.is_active = true
      and profile.privacy_blocked = false
      and profile.auto_public_eligible = true
      and profile.claimed_workspace_id is null
      and facts.last_synced_at >= profile.last_synced_at
      and facts.source_payload_hash <> ''
      and facts.deregistration_date is null
      and coalesce(facts.advertising_blocked, false) = false
      and jsonb_array_length(coalesce(facts.ongoing_procedures, '[]'::jsonb)) = 0
    order by profile.organization_number asc
    offset ${scanOffset}
    limit ${READY_AUTO_PUBLISH_SCAN_SIZE}
  `;

  const seenProfileIds = new Set<string>();
  const uniqueFreshRows = freshRows.filter((row) => {
    const profileId = text(row.id);
    if (!profileId || seenProfileIds.has(profileId)) return false;
    seenProfileIds.add(profileId);
    return true;
  });
  const uniqueBacklogRows = backlogRows.filter((row) => {
    const profileId = text(row.id);
    if (!profileId || seenProfileIds.has(profileId)) return false;
    seenProfileIds.add(profileId);
    return true;
  });

  const freshHighConfidence = uniqueFreshRows.filter(isHighConfidenceReadyRow);
  const backlogHighConfidence = uniqueBacklogRows.filter(isHighConfidenceReadyRow);
  const highConfidence = freshHighConfidence.length + backlogHighConfidence.length;

  // Reserve one publication attempt for the rotating backlog whenever that window
  // contains an eligible profile. The remaining capacity favors the fresh lane.
  // This keeps the fast path responsive without allowing a continuous fresh inflow
  // to starve older Ready companies indefinitely.
  const backlogReserved = backlogHighConfidence.slice(0, Math.min(1, safeLimit));
  const freshCapacity = Math.max(0, safeLimit - backlogReserved.length);
  const freshSelected = freshHighConfidence.slice(0, freshCapacity);
  const selected = [...freshSelected, ...backlogReserved];
  const remainingCapacity = safeLimit - selected.length;
  if (remainingCapacity > 0) {
    selected.push(
      ...backlogHighConfidence.slice(
        backlogReserved.length,
        backlogReserved.length + remainingCapacity,
      ),
    );
  }

  let published = 0;
  let queueSynced = 0;
  let deferred = 0;
  let errors = 0;
  const errorMessages: string[] = [];

  for (const row of selected) {
    const profileId = text(row.id);
    if (!profileId) {
      errors += 1;
      if (errorMessages.length < 5) errorMessages.push("Ready profile is missing an id");
      continue;
    }

    try {
      const publication = await autoPublishCompanyDirectoryProfileIfSafe(profileId);
      if (!publication) {
        deferred += 1;
        continue;
      }

      if (publication.ok) {
        published += 1;
        if (await syncPublishedQueueState(profileId)) queueSynced += 1;
        continue;
      }

      if (
        publication.code === "not_ready"
        || publication.code === "unsafe"
        || publication.code === "low_confidence"
        || publication.code === "not_found"
      ) {
        deferred += 1;
        continue;
      }

      errors += 1;
      if (errorMessages.length < 5) {
        errorMessages.push(`${profileId}: automatic publication failed (${publication.code})`);
      }
    } catch (error) {
      errors += 1;
      if (errorMessages.length < 5) {
        errorMessages.push(
          `${profileId}: ${error instanceof Error ? error.message : "Unknown automatic publication error"}`,
        );
      }
    }
  }

  return {
    skipped: false,
    safetyEligible,
    scanned: uniqueFreshRows.length + uniqueBacklogRows.length,
    highConfidence,
    selected: selected.length,
    published,
    queueSynced,
    deferred,
    errors,
    errorSummary: errorMessages.join(" | "),
  };
}
