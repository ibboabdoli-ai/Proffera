import "server-only";

import { assessCompanyDirectoryCategoryConfidence } from "@/lib/company-directory-category-confidence";
import { enrichCompanyDirectoryScbForProfile } from "@/lib/company-directory-scb-enrichment";
import { createScbCompanyRegistryTransportFromEnv } from "@/lib/company-directory-scb-transport";
import { getSql } from "@/lib/db/server";

// This is an opt-in pilot. The existing full revalidation job is not changed.
// Never enable new SCB traffic just because the automatic discovery queue is on.
const DEFAULT_BATCH_SIZE = 2;
const MAX_BATCH_SIZE = 3;
const SCAN_SIZE = 25;
const MIN_REQUEST_HEADROOM_MS = 5_000;
const ROTATION_MS = 15 * 60 * 1_000;

type Result = {
  skipped: boolean;
  reason: string;
  scanned: number;
  attempted: number;
  saved: number;
  deferred: number;
  errors: number;
  errorSummary: string;
};

function emptyResult(reason: string): Result {
  return {
    skipped: true,
    reason,
    scanned: 0,
    attempted: 0,
    saved: 0,
    deferred: 0,
    errors: 0,
    errorSummary: "",
  };
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function batchLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_BATCH_SIZE;
  return Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(parsed)));
}

/**
 * Fetch missing SCB workplace evidence for a few safe Ready candidates.
 * Publication is NOT performed here. The existing high-confidence publication
 * worker validates snapshot tokens, exact workplace, SNI, pilot city and safety
 * rules on the following cron run. This worker cannot relax those gates.
 */
export async function enrichReadyCompanyDirectoryScbBatch(
  options: { deadlineAt?: number; limit?: number } = {},
): Promise<Result> {
  if (process.env.COMPANY_DIRECTORY_READY_SCB_ENRICHMENT_ENABLED !== "true") {
    return emptyResult("pilot_disabled");
  }
  if (process.env.COMPANY_DIRECTORY_AUTO_PUBLISH !== "true") {
    return emptyResult("auto_publication_disabled");
  }
  if (options.deadlineAt && Date.now() + MIN_REQUEST_HEADROOM_MS >= options.deadlineAt) {
    return emptyResult("deadline_reached");
  }

  const sql = getSql();
  if (!sql) return emptyResult("database_unavailable");

  // The production SCB credential is already used by the separate full
  // revalidation worker. Passing a transport explicitly allows this *scoped*
  // pilot to work without changing the global SCB enable flag.
  const transport = createScbCompanyRegistryTransportFromEnv();
  if (!transport) return emptyResult("scb_credentials_unavailable");

  const limit = batchLimit(options.limit ?? process.env.COMPANY_DIRECTORY_READY_SCB_BATCH_SIZE);
  const rotationKey = String(Math.floor(Date.now() / ROTATION_MS));

  // Profile/registered address is only a PRIORITY hint; it is never evidence
  // of an eligible workplace. The publication gate uses the physical SCB
  // visiting address instead. Rotate the other candidates to avoid a
  // permanently failing organization blocking the Ready backlog.
  const candidates = await sql`
    select profile.id::text,
           profile.category_slug, profile.primary_sni_code,
           profile.legal_name, profile.display_name, profile.activity_description,
           facts.registered_names, facts.sni_codes
    from company_directory_profiles profile
    join company_directory_official_facts facts on facts.profile_id = profile.id
    left join company_directory_scb_enrichment scb on scb.profile_id = profile.id
    where profile.country_code = 'SE'
      and profile.organization_kind = 'juridical_person'
      and profile.publication_status = 'ready'
      and profile.is_active = true
      and profile.privacy_blocked = false
      and profile.auto_public_eligible = true
      and profile.claimed_workspace_id is null
      and facts.source_payload_hash <> ''
      and facts.last_synced_at >= profile.last_synced_at
      and facts.deregistration_date is null
      and coalesce(facts.advertising_blocked, false) = false
      and jsonb_typeof(facts.ongoing_procedures) = 'array'
      and jsonb_array_length(facts.ongoing_procedures) = 0
      and scb.profile_id is null
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
    order by
      case when lower(btrim(profile.city)) in ('stockholm', 'södertälje')
             or lower(btrim(profile.municipality)) in ('stockholm', 'södertälje')
        then 0 else 1 end,
      md5(profile.organization_number || ${rotationKey})
    limit ${SCAN_SIZE}
  `;

  let attempted = 0;
  let saved = 0;
  let deferred = 0;
  let errors = 0;
  const messages: string[] = [];
  for (const row of candidates) {
    if (attempted >= limit) break;
    if (options.deadlineAt && Date.now() + MIN_REQUEST_HEADROOM_MS >= options.deadlineAt) {
      deferred += 1;
      break;
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
    if (!confidence.officialFactsReady || confidence.score < 95) {
      deferred += 1;
      continue;
    }

    const profileId = text(row.id);
    if (!profileId) {
      errors += 1;
      continue;
    }

    attempted += 1;
    try {
      const result = await enrichCompanyDirectoryScbForProfile(profileId, transport, {
        allowWhenDisabledWithExplicitTransport: true,
      });
      if (result.status === "saved") saved += 1;
      else deferred += 1;
    } catch (error) {
      errors += 1;
      if (messages.length < 3) {
        messages.push(`${profileId}: ${error instanceof Error ? error.message : "SCB enrichment failed"}`);
      }
    }
  }

  return {
    skipped: false,
    reason: "",
    scanned: candidates.length,
    attempted,
    saved,
    deferred,
    errors,
    errorSummary: messages.join(" | "),
  };
}
