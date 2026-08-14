import "server-only";

import { randomUUID } from "node:crypto";

import { getSql } from "@/lib/db/server";
import { upsertCompanyDirectoryCandidate } from "@/lib/company-directory-engine";
import { enrichCompanyDirectoryOfficialFactsForProfile } from "@/lib/company-directory-official-facts";
import { normalizeSniCode, type NormalizedDirectoryCandidate } from "@/lib/company-directory-policy";
import { autoPublishCompanyDirectoryProfileIfSafe } from "@/lib/company-directory-publication";
import { verifyOfficialCompanyCandidate } from "@/lib/company-directory-source";

const DEFAULT_PROVIDER = "bolagsverket_vardefulla_datamangder";
const MAX_INGEST_PER_REQUEST = 500;
const MAX_PROCESS_PER_RUN = 20;
const LEASE_MINUTES = 15;
const MAX_ATTEMPTS = 5;

type EnqueueInput = {
  provider?: string;
  sourceUrl?: string;
  fingerprint: string;
  candidates: Array<{
    organizationNumber: string;
    primarySniCode: string;
  }>;
  discoveredCount?: number;
  acceptedCount?: number;
  final?: boolean;
};

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeOrganizationNumber(value: unknown) {
  return text(value).replace(/\D/g, "");
}

function normalizePrimarySniCode(value: unknown) {
  const digits = text(value).replace(/\D/g, "");
  return /^\d{4,5}$/.test(digits) ? digits : "";
}

function boundedInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(parsed)));
}

function safeProvider(value: unknown) {
  return text(value).slice(0, 120) || DEFAULT_PROVIDER;
}

function safeSourceUrl(value: unknown) {
  const raw = text(value);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return "";
    if (host !== "bolagsverket.se" && !host.endsWith(".bolagsverket.se")) return "";
    return url.toString().slice(0, 2000);
  } catch {
    return "";
  }
}

function safeFingerprint(value: unknown) {
  const normalized = text(value).toLowerCase();
  return /^[a-f0-9]{32,128}$/.test(normalized) ? normalized : "";
}

function detailVerificationConfigured() {
  const detail = process.env.COMPANY_DIRECTORY_DETAIL_URL_TEMPLATE?.trim();
  const staticToken = process.env.COMPANY_DIRECTORY_SOURCE_BEARER_TOKEN?.trim();
  const oauth = process.env.COMPANY_DIRECTORY_TOKEN_URL?.trim()
    && process.env.BOLAGSVERKET_CLIENT_ID?.trim()
    && process.env.BOLAGSVERKET_CLIENT_SECRET?.trim();
  return Boolean(detail && (staticToken || oauth));
}

function seedCandidate(
  organizationNumber: string,
  provider: string,
  primarySniCode: string,
): NormalizedDirectoryCandidate {
  return {
    countryCode: "SE",
    organizationNumber,
    organizationKind: "unknown",
    legalName: "",
    displayName: "",
    legalForm: "",
    organizationStatus: "",
    isActive: false,
    fTaxStatus: "",
    vatStatus: "",
    employerStatus: "",
    primarySniCode: normalizeSniCode(primarySniCode),
    primarySniLabel: "",
    primarySniVerified: false,
    activityDescription: "",
    addressLine1: "",
    postalCode: "",
    city: "",
    municipality: "",
    region: "",
    officialSource: provider,
    sourceRecordId: organizationNumber,
    sourceUpdatedAt: null,
  };
}

export async function enqueueCompanyDirectoryCandidates(input: EnqueueInput) {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  const provider = safeProvider(input.provider);
  const sourceUrl = safeSourceUrl(input.sourceUrl);
  const fingerprint = safeFingerprint(input.fingerprint);
  if (!sourceUrl) throw new Error("An official Bolagsverket source URL is required");
  if (!fingerprint) throw new Error("A valid discovery fingerprint is required");

  const candidatesByOrganizationNumber = new Map<string, string>();
  for (const candidate of input.candidates.slice(0, MAX_INGEST_PER_REQUEST)) {
    const organizationNumber = normalizeOrganizationNumber(candidate.organizationNumber);
    if (organizationNumber.length !== 10) continue;
    const primarySniCode = normalizePrimarySniCode(candidate.primarySniCode);
    const existing = candidatesByOrganizationNumber.get(organizationNumber) ?? "";
    if (existing && primarySniCode && existing !== primarySniCode) {
      throw new Error(`Conflicting primary SNI codes for ${organizationNumber}`);
    }
    candidatesByOrganizationNumber.set(organizationNumber, primarySniCode || existing);
  }
  const candidates = [...candidatesByOrganizationNumber].map(([organizationNumber, primarySniCode]) => ({
    organizationNumber,
    primarySniCode,
  }));
  const discoveredCount = Math.max(0, Math.floor(Number(input.discoveredCount) || 0));
  const acceptedCount = Math.max(
    candidates.length,
    Math.floor(Number(input.acceptedCount) || 0),
  );
  const itemsJson = JSON.stringify(candidates.map((candidate) => ({
    organization_number: candidate.organizationNumber,
    primary_sni_code: candidate.primarySniCode,
  })));

  await sql.transaction((tx) => [
    tx`
      insert into company_directory_source_snapshots (
        provider, source_url, fingerprint, status, discovered_count, accepted_count,
        first_seen_at, last_seen_at, completed_at
      ) values (
        ${provider}, ${sourceUrl}, ${fingerprint}, ${input.final ? "completed" : "processing"},
        ${discoveredCount}, ${acceptedCount}, now(), now(),
        case when ${Boolean(input.final)} then now() else null end
      )
      on conflict (provider, fingerprint) do update set
        source_url = case when excluded.source_url <> '' then excluded.source_url else company_directory_source_snapshots.source_url end,
        status = case when excluded.status = 'completed' then 'completed' else company_directory_source_snapshots.status end,
        discovered_count = greatest(company_directory_source_snapshots.discovered_count, excluded.discovered_count),
        accepted_count = greatest(company_directory_source_snapshots.accepted_count, excluded.accepted_count),
        last_seen_at = now(),
        completed_at = case when excluded.status = 'completed' then now() else company_directory_source_snapshots.completed_at end
    `,
    tx`
      insert into company_directory_discovery_queue (
        country_code, organization_number, primary_sni_code, provider, source_fingerprint, source_url,
        state, attempt_count, next_attempt_at, first_seen_at, last_seen_at
      )
      select
        'SE', item.organization_number, item.primary_sni_code, ${provider}, ${fingerprint}, ${sourceUrl},
        'pending_verify', 0, now(), now(), now()
      from jsonb_to_recordset(${itemsJson}::jsonb)
        as item(organization_number text, primary_sni_code text)
      on conflict (country_code, organization_number) do update set
        primary_sni_code = case
          when excluded.primary_sni_code <> '' then excluded.primary_sni_code
          else company_directory_discovery_queue.primary_sni_code
        end,
        provider = excluded.provider,
        source_url = case when excluded.source_url <> '' then excluded.source_url else company_directory_discovery_queue.source_url end,
        last_seen_at = now(),
        state = case
          when (
            company_directory_discovery_queue.source_fingerprint <> excluded.source_fingerprint
            or (
              excluded.primary_sni_code <> ''
              and company_directory_discovery_queue.primary_sni_code <> excluded.primary_sni_code
            )
          )
            and company_directory_discovery_queue.state <> 'claimed'
            then 'pending_verify'
          else company_directory_discovery_queue.state
        end,
        attempt_count = case
          when company_directory_discovery_queue.source_fingerprint <> excluded.source_fingerprint
            or (
              excluded.primary_sni_code <> ''
              and company_directory_discovery_queue.primary_sni_code <> excluded.primary_sni_code
            )
            then 0
          else company_directory_discovery_queue.attempt_count
        end,
        next_attempt_at = case
          when company_directory_discovery_queue.source_fingerprint <> excluded.source_fingerprint
            or (
              excluded.primary_sni_code <> ''
              and company_directory_discovery_queue.primary_sni_code <> excluded.primary_sni_code
            )
            then now()
          else company_directory_discovery_queue.next_attempt_at
        end,
        source_fingerprint = excluded.source_fingerprint,
        last_error = case
          when company_directory_discovery_queue.source_fingerprint <> excluded.source_fingerprint
            or (
              excluded.primary_sni_code <> ''
              and company_directory_discovery_queue.primary_sni_code <> excluded.primary_sni_code
            )
            then ''
          else company_directory_discovery_queue.last_error
        end
    `,
  ]);

  return {
    provider,
    fingerprint,
    accepted: candidates.length,
    acceptedTotal: acceptedCount,
    final: Boolean(input.final),
  };
}

async function reassertTerminalQueueFailure(input: {
  id: string;
  profileId: string;
  attemptCount: number;
  sourceFingerprint: string;
  error: string;
}) {
  const sql = getSql();
  if (!sql) return;
  await sql`
    update company_directory_discovery_queue
    set state = 'failed',
        locked_at = null,
        lock_token = null,
        last_error = ${input.error.slice(0, 1000)},
        next_attempt_at = now() + interval '24 hours'
    where id = ${input.id}::uuid
      and profile_id = ${input.profileId}::uuid
      and attempt_count = ${input.attemptCount}
      and source_fingerprint = ${input.sourceFingerprint}
  `;
}

async function recoverStaleQueueLeases() {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");

  const recovered = await sql`
    update company_directory_discovery_queue
    set state = case when attempt_count >= ${MAX_ATTEMPTS} then 'failed' else 'pending_verify' end,
        locked_at = null,
        lock_token = null,
        next_attempt_at = case
          when attempt_count >= ${MAX_ATTEMPTS} then now() + interval '24 hours'
          else now()
        end,
        last_error = case
          when last_error = '' then 'verification lease expired before completion'
          else last_error
        end
    where state = 'processing'
      and locked_at < now() - (${LEASE_MINUTES}::text || ' minutes')::interval
    returning id::text, profile_id::text, source_fingerprint, attempt_count, last_error
  `;

  for (const row of recovered) {
    const attemptCount = Number(row.attempt_count) || 0;
    const profileId = text(row.profile_id);
    if (attemptCount < MAX_ATTEMPTS || !profileId) continue;

    await sql`
      update company_directory_profiles
      set publication_status = 'review',
          updated_at = now()
      where id = ${profileId}::uuid
        and publication_status = 'ready'
    `;
    await reassertTerminalQueueFailure({
      id: text(row.id),
      profileId,
      attemptCount,
      sourceFingerprint: text(row.source_fingerprint),
      error: text(row.last_error) || "verification lease expired before completion",
    });
  }
}

type QueueClaimOptions = {
  organizationNumber?: string;
  requireUnprofiled?: boolean;
  pilotRetryPrefix?: string;
};

async function claimQueueBatch(limit: number, options: QueueClaimOptions = {}) {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");
  const token = randomUUID();
  const organizationNumber = normalizeOrganizationNumber(options.organizationNumber);
  const requireUnprofiled = Boolean(options.requireUnprofiled);
  const pilotRetryPrefix = text(options.pilotRetryPrefix);

  const rows = await sql`
    with candidates as (
      select queue.id
      from company_directory_discovery_queue queue
      where queue.state = 'pending_verify'
        and queue.next_attempt_at <= now()
        and (${organizationNumber} = '' or queue.organization_number = ${organizationNumber})
        and (
          not ${requireUnprofiled}
          or (
            queue.primary_sni_code <> ''
            and (
              not exists (
                select 1
                from company_directory_profiles profile
                where profile.country_code = queue.country_code
                  and regexp_replace(profile.organization_number, '[^0-9]', '', 'g') = queue.organization_number
              )
              or (
                ${pilotRetryPrefix} <> ''
                and queue.profile_id is not null
                and queue.last_error like ${`${pilotRetryPrefix}%`}
              )
            )
          )
        )
      order by queue.first_seen_at asc, queue.organization_number asc
      for update skip locked
      limit ${limit}
    )
    update company_directory_discovery_queue queue
    set state = 'processing',
        attempt_count = queue.attempt_count + 1,
        locked_at = now(),
        lock_token = ${token}::uuid
    from candidates
    where queue.id = candidates.id
    returning
      queue.id::text,
      queue.organization_number,
      queue.primary_sni_code,
      queue.provider,
      queue.source_fingerprint,
      queue.attempt_count,
      queue.lock_token::text
  `;

  return rows.map((row) => ({
    id: text(row.id),
    organizationNumber: normalizeOrganizationNumber(row.organization_number),
    primarySniCode: normalizePrimarySniCode(row.primary_sni_code),
    provider: safeProvider(row.provider),
    sourceFingerprint: text(row.source_fingerprint),
    attemptCount: Number(row.attempt_count) || 1,
    lockToken: text(row.lock_token),
  }));
}

async function restoreQueueLeaseAfterProfileUpsert(input: {
  id: string;
  lockToken: string;
  profileId: string;
  attemptCount: number;
  sourceFingerprint: string;
}) {
  const sql = getSql();
  if (!sql) throw new Error("Database is not configured");
  const rows = await sql`
    update company_directory_discovery_queue
    set state = 'processing',
        profile_id = ${input.profileId}::uuid,
        locked_at = now(),
        lock_token = ${input.lockToken}::uuid
    where id = ${input.id}::uuid
      and profile_id = ${input.profileId}::uuid
      and attempt_count = ${input.attemptCount}
      and source_fingerprint = ${input.sourceFingerprint}
      and locked_at is null
      and lock_token is null
    returning id::text
  `;
  if (!rows[0]) {
    throw new Error("Directory queue lease changed during profile upsert");
  }
}

async function completeQueueItem(input: {
  id: string;
  lockToken: string;
  state: string;
  profileId: string;
}) {
  const sql = getSql();
  if (!sql) return;
  await sql`
    update company_directory_discovery_queue
    set state = ${input.state},
        profile_id = ${input.profileId}::uuid,
        verified_at = now(),
        locked_at = null,
        lock_token = null,
        last_error = '',
        next_attempt_at = now()
    where id = ${input.id}::uuid
      and lock_token = ${input.lockToken}::uuid
  `;
}

async function failQueueItem(input: {
  id: string;
  lockToken: string;
  sourceFingerprint: string;
  attemptCount: number;
  error: string;
  profileId?: string;
  errorPrefix?: string;
}) {
  const sql = getSql();
  if (!sql) return;
  const terminal = input.attemptCount >= MAX_ATTEMPTS;
  const delayMinutes = terminal ? 24 * 60 : Math.min(360, 2 ** Math.max(0, input.attemptCount - 1));
  const profileId = text(input.profileId);
  const error = `${input.errorPrefix ?? ""}${input.error}`.slice(0, 1000);
  const failedRows = await sql`
    update company_directory_discovery_queue
    set state = ${terminal ? "failed" : "pending_verify"},
        profile_id = coalesce(nullif(${profileId}, '')::uuid, profile_id),
        locked_at = null,
        lock_token = null,
        last_error = ${error},
        next_attempt_at = now() + (${delayMinutes}::text || ' minutes')::interval
    where id = ${input.id}::uuid
      and lock_token = ${input.lockToken}::uuid
      and attempt_count = ${input.attemptCount}
      and source_fingerprint = ${input.sourceFingerprint}
    returning profile_id::text
  `;
  const failedProfileId = text(failedRows[0]?.profile_id);
  if (!terminal || !failedProfileId) return;

  await sql`
    update company_directory_profiles
    set publication_status = 'review',
        updated_at = now()
    where id = ${failedProfileId}::uuid
      and publication_status = 'ready'
  `;
  await reassertTerminalQueueFailure({
    id: input.id,
    profileId: failedProfileId,
    attemptCount: input.attemptCount,
    sourceFingerprint: input.sourceFingerprint,
    error,
  });
}

async function requeueTargetedPilotItem(input: {
  id: string;
  lockToken: string;
  profileId: string;
  sourceFingerprint: string;
  attemptCount: number;
  error: string;
}) {
  return failQueueItem({
    ...input,
    errorPrefix: "targeted pilot retry: ",
  });
}

async function targetedPilotProfileId(queueId: string, organizationNumber: string) {
  const sql = getSql();
  if (!sql) return "";
  const rows = await sql`
    select profile_id::text
    from company_directory_discovery_queue
    where id = ${queueId}::uuid
      and organization_number = ${organizationNumber}
      and profile_id is not null
    limit 1
  `;
  return text(rows[0]?.profile_id);
}

export async function processCompanyDirectoryDiscoveryQueue(limit?: number) {
  if (!getSql()) throw new Error("Database is not configured");
  if (!detailVerificationConfigured()) {
    throw new Error("Automatic discovery requires official detail verification and credentials");
  }
  await recoverStaleQueueLeases();

  const safeLimit = boundedInteger(
    limit ?? process.env.COMPANY_DIRECTORY_QUEUE_BATCH_SIZE,
    15,
    MAX_PROCESS_PER_RUN,
  );
  const claimed = await claimQueueBatch(safeLimit);

  let processed = 0;
  let published = 0;
  let blocked = 0;
  let errors = 0;
  const errorMessages: string[] = [];

  for (const item of claimed) {
    let itemProfileId = "";
    try {
      const verified = await verifyOfficialCompanyCandidate(
        seedCandidate(item.organizationNumber, `${item.provider}:discovery`, item.primarySniCode),
      );
      const result = await upsertCompanyDirectoryCandidate(verified);
      itemProfileId = result.profileId;
      await restoreQueueLeaseAfterProfileUpsert({
        id: item.id,
        lockToken: item.lockToken,
        profileId: result.profileId,
        attemptCount: item.attemptCount,
        sourceFingerprint: item.sourceFingerprint,
      });
      await enrichCompanyDirectoryOfficialFactsForProfile(result.profileId);
      const autoPublication = result.publicationStatus === "ready"
        ? await autoPublishCompanyDirectoryProfileIfSafe(result.profileId)
        : null;
      if (
        autoPublication
        && !autoPublication.ok
        && autoPublication.code !== "unsafe"
        && autoPublication.code !== "low_confidence"
      ) {
        throw new Error(`Automatic publication requires retry (${autoPublication.code})`);
      }
      const publicationStatus = autoPublication?.ok ? "published" : result.publicationStatus;
      await completeQueueItem({
        id: item.id,
        lockToken: item.lockToken,
        state: publicationStatus,
        profileId: result.profileId,
      });
      processed += 1;
      if (publicationStatus === "published") published += 1;
      if (result.blocked) blocked += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown queue processing error";
      await failQueueItem({
        id: item.id,
        lockToken: item.lockToken,
        sourceFingerprint: item.sourceFingerprint,
        attemptCount: item.attemptCount,
        error: message,
        profileId: itemProfileId,
      });
      errors += 1;
      if (errorMessages.length < 8) errorMessages.push(`${item.organizationNumber}: ${message}`);
    }
  }

  return {
    claimed: claimed.length,
    processed,
    published,
    blocked,
    errors,
    errorSummary: errorMessages.join(" | "),
  };
}

async function requeueControlledBatchPilotItem(input: {
  id: string;
  lockToken: string;
  profileId: string;
  sourceFingerprint: string;
  attemptCount: number;
  error: string;
}) {
  return failQueueItem({
    ...input,
    errorPrefix: "controlled batch pilot retry: ",
  });
}

export async function processNewCompanyDirectoryDiscoveryQueueCandidate(organizationNumber: unknown) {
  if (!getSql()) throw new Error("Database is not configured");
  if (!detailVerificationConfigured()) {
    throw new Error("Automatic discovery requires official detail verification and credentials");
  }

  const normalizedOrganizationNumber = normalizeOrganizationNumber(organizationNumber);
  if (normalizedOrganizationNumber.length !== 10) {
    throw new Error("A 10-digit organization number is required");
  }

  await recoverStaleQueueLeases();
  const claimed = await claimQueueBatch(1, {
    organizationNumber: normalizedOrganizationNumber,
    requireUnprofiled: true,
    pilotRetryPrefix: "targeted pilot retry:",
  });

  let processed = 0;
  let published = 0;
  let blocked = 0;
  let errors = 0;
  let profileId = "";
  const errorMessages: string[] = [];

  for (const item of claimed) {
    let itemProfileId = "";
    try {
      const verified = await verifyOfficialCompanyCandidate(
        seedCandidate(item.organizationNumber, `${item.provider}:discovery`, item.primarySniCode),
      );
      const result = await upsertCompanyDirectoryCandidate(verified);
      itemProfileId = result.profileId;
      await restoreQueueLeaseAfterProfileUpsert({
        id: item.id,
        lockToken: item.lockToken,
        profileId: result.profileId,
        attemptCount: item.attemptCount,
        sourceFingerprint: item.sourceFingerprint,
      });
      await enrichCompanyDirectoryOfficialFactsForProfile(result.profileId);
      await completeQueueItem({
        id: item.id,
        lockToken: item.lockToken,
        state: result.publicationStatus,
        profileId: result.profileId,
      });
      profileId = result.profileId;
      processed += 1;
      if (result.publicationStatus === "published") published += 1;
      if (result.blocked) blocked += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown queue processing error";
      const retryProfileId = itemProfileId || await targetedPilotProfileId(
        item.id,
        item.organizationNumber,
      );
      if (retryProfileId) {
        await requeueTargetedPilotItem({
          id: item.id,
          lockToken: item.lockToken,
          profileId: retryProfileId,
          sourceFingerprint: item.sourceFingerprint,
          attemptCount: item.attemptCount,
          error: message,
        });
      } else {
        await failQueueItem({
          id: item.id,
          lockToken: item.lockToken,
          sourceFingerprint: item.sourceFingerprint,
          attemptCount: item.attemptCount,
          error: message,
        });
      }
      errors += 1;
      errorMessages.push(`${item.organizationNumber}: ${message}`);
    }
  }

  return {
    organizationNumber: normalizedOrganizationNumber,
    profileId,
    claimed: claimed.length,
    processed,
    published,
    blocked,
    errors,
    errorSummary: errorMessages.join(" | "),
  };
}

export async function processNewCompanyDirectoryDiscoveryQueueBatch(limit?: number) {
  if (!getSql()) throw new Error("Database is not configured");
  if (!detailVerificationConfigured()) {
    throw new Error("Automatic discovery requires official detail verification and credentials");
  }

  const safeLimit = boundedInteger(limit, 5, 5);
  await recoverStaleQueueLeases();
  const claimed = await claimQueueBatch(safeLimit, {
    requireUnprofiled: true,
    pilotRetryPrefix: "controlled batch pilot retry:",
  });

  let processed = 0;
  let published = 0;
  let blocked = 0;
  let errors = 0;
  const errorMessages: string[] = [];

  for (const item of claimed) {
    let itemProfileId = "";
    try {
      const verified = await verifyOfficialCompanyCandidate(
        seedCandidate(item.organizationNumber, `${item.provider}:discovery`, item.primarySniCode),
      );
      const result = await upsertCompanyDirectoryCandidate(verified);
      itemProfileId = result.profileId;
      await restoreQueueLeaseAfterProfileUpsert({
        id: item.id,
        lockToken: item.lockToken,
        profileId: result.profileId,
        attemptCount: item.attemptCount,
        sourceFingerprint: item.sourceFingerprint,
      });
      await enrichCompanyDirectoryOfficialFactsForProfile(result.profileId);
      await completeQueueItem({
        id: item.id,
        lockToken: item.lockToken,
        state: result.publicationStatus,
        profileId: result.profileId,
      });
      processed += 1;
      if (result.publicationStatus === "published") published += 1;
      if (result.blocked) blocked += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown queue processing error";
      const retryProfileId = itemProfileId || await targetedPilotProfileId(
        item.id,
        item.organizationNumber,
      );
      if (retryProfileId) {
        await requeueControlledBatchPilotItem({
          id: item.id,
          lockToken: item.lockToken,
          profileId: retryProfileId,
          sourceFingerprint: item.sourceFingerprint,
          attemptCount: item.attemptCount,
          error: message,
        });
      } else {
        await failQueueItem({
          id: item.id,
          lockToken: item.lockToken,
          sourceFingerprint: item.sourceFingerprint,
          attemptCount: item.attemptCount,
          error: message,
        });
      }
      errors += 1;
      if (errorMessages.length < 8) errorMessages.push(`${item.organizationNumber}: ${message}`);
    }
  }

  return {
    limit: safeLimit,
    claimed: claimed.length,
    processed,
    published,
    blocked,
    errors,
    errorSummary: errorMessages.join(" | "),
  };
}

export async function getCompanyDirectoryDiscoveryQueueSnapshot() {
  const sql = getSql();
  if (!sql) return { counts: {} as Record<string, number>, latestSnapshot: null };

  const [countRows, snapshotRows] = await Promise.all([
    sql`
      select state, count(*)::int as count
      from company_directory_discovery_queue
      group by state
    `,
    sql`
      select provider, source_url, fingerprint, status, discovered_count, accepted_count,
             first_seen_at, last_seen_at, completed_at, error_summary
      from company_directory_source_snapshots
      order by last_seen_at desc
      limit 1
    `,
  ]);

  const counts: Record<string, number> = {};
  for (const row of countRows) counts[text(row.state)] = Number(row.count) || 0;

  const row = snapshotRows[0];
  return {
    counts,
    latestSnapshot: row ? {
      provider: text(row.provider),
      sourceUrl: text(row.source_url),
      fingerprint: text(row.fingerprint),
      status: text(row.status),
      discovered: Number(row.discovered_count) || 0,
      accepted: Number(row.accepted_count) || 0,
      firstSeenAt: text(row.first_seen_at),
      lastSeenAt: text(row.last_seen_at),
      completedAt: text(row.completed_at),
      errorSummary: text(row.error_summary),
    } : null,
  };
}
