import "server-only";

import type { DirectoryGuestLeadMatch } from "@/features/matching/directory-guest";
import { getSql } from "@/lib/db/server";

const REMATCH_LEASE_MINUTES = 10;

export type MarketplaceRematchWorkerEntry = {
  rematchId: string;
  sourceQuoteRequestId: string;
  rematchQuoteRequestId: string;
  excludedProfileIds: Set<string>;
  excludedRecipientEmails: Set<string>;
};

export type MarketplaceRematchWorkerContext = Map<string, MarketplaceRematchWorkerEntry>;

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizedEmail(value: unknown) {
  return text(value).toLowerCase();
}

function compatibilityError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  return code === "42P01" || code === "42703";
}

export async function prepareMarketplaceRematchWork(limit = 5): Promise<MarketplaceRematchWorkerContext> {
  const sql = getSql();
  if (!sql) return new Map();
  const boundedLimit = Math.max(1, Math.min(10, Math.floor(Number(limit) || 5)));

  try {
    const claimed = await sql`
      with candidates as (
        select rematch.id
        from marketplace_rematch_requests rematch
        join quote_requests next_request on next_request.id = rematch.rematch_quote_request_id
        where (
          rematch.status = 'pending'
          or (
            rematch.status = 'processing'
            and rematch.processing_started_at <= now() - (${REMATCH_LEASE_MINUTES}::int * interval '1 minute')
          )
        )
          and next_request.status in ('draft', 'submitted')
        order by rematch.created_at asc, rematch.id asc
        for update of rematch skip locked
        limit ${boundedLimit}
      ), leased as (
        update marketplace_rematch_requests rematch
        set status = 'processing',
            processing_started_at = now(),
            processed_at = null,
            updated_at = now()
        from candidates
        where rematch.id = candidates.id
        returning
          rematch.id::text,
          rematch.source_quote_request_id::text,
          rematch.rematch_quote_request_id::text
      ), activated as (
        update quote_requests request
        set status = 'submitted', updated_at = now()
        from leased
        where request.id = leased.rematch_quote_request_id::uuid
          and request.status = 'draft'
        returning request.id
      )
      select leased.*
      from leased
      left join activated on activated.id = leased.rematch_quote_request_id::uuid
    `;

    if (claimed.length === 0) return new Map();
    const sourceIds = claimed.map((row) => text(row.source_quote_request_id)).filter(Boolean);
    const sourceCsv = sourceIds.join(",");
    const exclusions = sourceCsv
      ? await sql`
          select
            invitation.quote_request_id::text,
            invitation.profile_id::text,
            lower(btrim(invitation.recipient_email)) as recipient_email
          from marketplace_quote_invitations invitation
          where invitation.quote_request_id = any(string_to_array(${sourceCsv}, ',')::uuid[])
        `
      : [];

    const exclusionsBySource = new Map<string, { profiles: Set<string>; emails: Set<string> }>();
    for (const row of exclusions) {
      const sourceId = text(row.quote_request_id);
      const bucket = exclusionsBySource.get(sourceId) ?? { profiles: new Set<string>(), emails: new Set<string>() };
      const profileId = text(row.profile_id);
      const email = normalizedEmail(row.recipient_email);
      if (profileId) bucket.profiles.add(profileId);
      if (email) bucket.emails.add(email);
      exclusionsBySource.set(sourceId, bucket);
    }

    const context: MarketplaceRematchWorkerContext = new Map();
    for (const row of claimed) {
      const sourceQuoteRequestId = text(row.source_quote_request_id);
      const rematchQuoteRequestId = text(row.rematch_quote_request_id);
      const blocked = exclusionsBySource.get(sourceQuoteRequestId) ?? { profiles: new Set<string>(), emails: new Set<string>() };
      context.set(rematchQuoteRequestId, {
        rematchId: text(row.id),
        sourceQuoteRequestId,
        rematchQuoteRequestId,
        excludedProfileIds: blocked.profiles,
        excludedRecipientEmails: blocked.emails,
      });
    }
    return context;
  } catch (error) {
    if (compatibilityError(error)) return new Map();
    console.error("Marketplace rematch queue claim failed", error);
    return new Map();
  }
}

export function applyMarketplaceRematchContext(
  matches: DirectoryGuestLeadMatch[],
  context: MarketplaceRematchWorkerContext,
) {
  if (context.size === 0) return matches;

  return matches
    .map((match) => {
      const rematch = context.get(match.lead.id);
      if (!rematch) return match;
      return {
        ...match,
        candidates: match.candidates.filter((candidate) => {
          if (rematch.excludedProfileIds.has(candidate.profileId)) return false;
          const email = normalizedEmail(candidate.recipientEmail);
          return !email || !rematch.excludedRecipientEmails.has(email);
        }),
      };
    })
    .sort((left, right) => Number(context.has(right.lead.id)) - Number(context.has(left.lead.id)));
}

export async function finalizeMarketplaceRematchWork(context: MarketplaceRematchWorkerContext) {
  const sql = getSql();
  if (!sql || context.size === 0) return;
  const rematchIds = [...context.values()].map((entry) => entry.rematchId).filter(Boolean);
  if (rematchIds.length === 0) return;
  const idCsv = rematchIds.join(",");

  try {
    await sql`
      with targets as (
        select
          rematch.id,
          rematch.rematch_quote_request_id,
          exists (
            select 1
            from marketplace_quote_invitations invitation
            where invitation.quote_request_id = rematch.rematch_quote_request_id
          ) as invitation_started
        from marketplace_rematch_requests rematch
        where rematch.id = any(string_to_array(${idCsv}, ',')::uuid[])
          and rematch.status = 'processing'
      ), completed as (
        update marketplace_rematch_requests rematch
        set status = 'processed',
            processed_at = now(),
            updated_at = now()
        from targets
        where rematch.id = targets.id
          and targets.invitation_started = true
        returning rematch.id
      ), retry as (
        update marketplace_rematch_requests rematch
        set status = 'pending',
            processing_started_at = null,
            updated_at = now()
        from targets
        where rematch.id = targets.id
          and targets.invitation_started = false
        returning rematch.rematch_quote_request_id
      )
      update quote_requests request
      set status = 'draft', updated_at = now()
      from retry
      where request.id = retry.rematch_quote_request_id
        and request.status = 'submitted'
    `;
  } catch (error) {
    if (compatibilityError(error)) return;
    console.error("Marketplace rematch queue finalization failed", error);
  }
}
