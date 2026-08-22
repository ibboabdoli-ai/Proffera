import "server-only";

import { getSql } from "@/lib/db/server";

export type MarketplaceCandidateInvitationState = {
  status: string;
  wave: 1 | 2;
  blocking: boolean;
  expiresAt: string;
};

export type MarketplaceLeadInvitationSummary = {
  wave1Count: number;
  wave2Count: number;
  totalCount: number;
  byProfile: Map<string, MarketplaceCandidateInvitationState>;
};

function emptySummary(): MarketplaceLeadInvitationSummary {
  return {
    wave1Count: 0,
    wave2Count: 0,
    totalCount: 0,
    byProfile: new Map(),
  };
}

export async function getMarketplaceInvitationSummaries(quoteRequestIds: string[]) {
  const summaries = new Map<string, MarketplaceLeadInvitationSummary>();
  for (const id of quoteRequestIds) summaries.set(id, emptySummary());
  if (quoteRequestIds.length === 0) return summaries;

  const sql = getSql();
  if (!sql) return summaries;

  const quoteRequestIdCsv = quoteRequestIds.join(",");
  const rows = await sql`
    select
      quote_request_id::text,
      profile_id::text,
      status,
      wave,
      expires_at::text,
      case
        when status = 'sending' then updated_at > now() - interval '5 minutes'
        when status = 'pending' then true
        when status in ('sent', 'viewed') then expires_at > now()
        when status in ('responded', 'delivery_uncertain') then true
        else false
      end as blocking
    from marketplace_quote_invitations
    where quote_request_id = any(string_to_array(${quoteRequestIdCsv}, ',')::uuid[])
    order by quote_request_id, created_at, id
  `;

  for (const raw of rows as Record<string, unknown>[]) {
    const quoteRequestId = String(raw.quote_request_id ?? "");
    const profileId = String(raw.profile_id ?? "");
    const wave = Number(raw.wave) === 2 ? 2 : 1;
    if (!quoteRequestId || !profileId) continue;

    const summary = summaries.get(quoteRequestId) ?? emptySummary();
    if (wave === 1) summary.wave1Count += 1;
    else summary.wave2Count += 1;
    summary.totalCount += 1;
    summary.byProfile.set(profileId, {
      status: String(raw.status ?? ""),
      wave,
      blocking: Boolean(raw.blocking),
      expiresAt: String(raw.expires_at ?? ""),
    });
    summaries.set(quoteRequestId, summary);
  }

  return summaries;
}

export async function expirePastMarketplaceInvitation(quoteRequestId: string, profileId: string) {
  const sql = getSql();
  if (!sql) return;

  // A sent/viewed guest link whose TTL elapsed is safe to expire. Do not auto-
  // expire provider-claimed pending/delivery_uncertain rows: those may represent
  // an ambiguous delivery and require the 0051 fail-closed reconciliation path.
  // SKIP LOCKED keeps admin-triggered wave dispatch from waiting behind a row
  // that another request is actively updating; the next reconciliation can
  // expire it after that transaction releases the lock.
  await sql`
    with expirable as (
      select id
      from marketplace_quote_invitations
      where quote_request_id = ${quoteRequestId}::uuid
        and profile_id = ${profileId}::uuid
        and expires_at <= now()
        and status in ('sent', 'viewed')
      for update skip locked
    )
    update marketplace_quote_invitations as invitation
    set status = 'expired', updated_at = now()
    from expirable
    where invitation.id = expirable.id
  `;
}
