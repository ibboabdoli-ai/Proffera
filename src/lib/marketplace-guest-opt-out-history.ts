import "server-only";

import { getSql } from "@/lib/db/server";
import {
  getMarketplaceGuestOptOutView,
  hashMarketplaceGuestToken,
  suppressMarketplaceGuestRecipient,
} from "@/lib/marketplace-guest-quote";

type MarketplaceGuestOptOutSummary = {
  status: string;
  companyName: string;
};

function validGuestToken(token: string) {
  return /^[A-Za-z0-9_-]{32,200}$/.test(token);
}

export async function getMarketplaceGuestOptOutViewWithHistory(
  token: string,
): Promise<MarketplaceGuestOptOutSummary | null> {
  const current = await getMarketplaceGuestOptOutView(token);
  if (current) {
    return { status: current.status, companyName: current.companyName };
  }
  if (!validGuestToken(token)) return null;

  const sql = getSql();
  if (!sql) return null;
  const tokenHash = hashMarketplaceGuestToken(token);
  const rows = await sql`
    select
      profile.display_name,
      case
        when exists (
          select 1
          from marketplace_outreach_suppressions suppression
          where suppression.email_normalized = credential.recipient_email_normalized
        ) then 'suppressed'
        else 'expired'
      end as status
    from marketplace_guest_opt_out_credentials credential
    join company_directory_profiles profile on profile.id = credential.profile_id
    where credential.token_hash = ${tokenHash}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;

  return {
    status: String(row.status),
    companyName: String(row.display_name),
  };
}

export async function suppressMarketplaceGuestRecipientWithHistory(token: string) {
  const current = await suppressMarketplaceGuestRecipient(token);
  if (current.ok || current.code !== "invalid") return current;
  if (!validGuestToken(token)) return current;

  const sql = getSql();
  if (!sql) return { ok: false as const, code: "invalid" };
  const tokenHash = hashMarketplaceGuestToken(token);
  const rows = await sql`
    select
      credential.invitation_id::text as invitation_id,
      credential.profile_id::text as profile_id,
      credential.recipient_email_normalized
    from marketplace_guest_opt_out_credentials credential
    where credential.token_hash = ${tokenHash}
    limit 1
  `;
  const row = rows[0];
  if (!row) return current;

  const invitationId = String(row.invitation_id);
  const profileId = String(row.profile_id);
  const email = String(row.recipient_email_normalized).trim().toLowerCase();

  await sql.transaction([
    sql`
      insert into marketplace_outreach_suppressions (
        profile_id, email_normalized, reason, source_invitation_id
      ) values (
        ${profileId}::uuid, ${email}, 'recipient_opt_out', ${invitationId}::uuid
      )
      on conflict (email_normalized) do nothing
    `,
    sql`
      update marketplace_quote_invitations
      set status = 'suppressed', updated_at = now()
      where lower(btrim(recipient_email)) = ${email}
        and (
          status in ('sending', 'sent', 'viewed', 'delivery_failed', 'expired', 'cancelled')
          or (status = 'pending' and updated_at <= now() - interval '5 minutes')
        )
    `,
  ]);

  const dispatchRows = await sql`
    select id
    from marketplace_quote_invitations
    where lower(btrim(recipient_email)) = ${email}
      and status = 'pending'
      and updated_at > now() - interval '5 minutes'
    limit 1
  `;
  if (dispatchRows[0]) {
    return { ok: false as const, code: "dispatch_in_progress" };
  }

  return { ok: true as const };
}
