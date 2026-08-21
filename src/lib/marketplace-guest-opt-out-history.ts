import "server-only";

import { getSql } from "@/lib/db/server";
import {
  isValidMarketplaceGuestToken,
  normalizeMarketplaceRecipientEmail,
  suppressMarketplaceGuestRecipientIdentity,
} from "@/lib/marketplace-guest-opt-out-core";
import {
  getMarketplaceGuestOptOutView,
  hashMarketplaceGuestToken,
  suppressMarketplaceGuestRecipient,
} from "@/lib/marketplace-guest-quote";

type MarketplaceGuestOptOutSummary = {
  status: string;
  companyName: string;
};

export async function getMarketplaceGuestOptOutViewWithHistory(
  token: string,
): Promise<MarketplaceGuestOptOutSummary | null> {
  const current = await getMarketplaceGuestOptOutView(token);
  if (current) {
    return { status: current.status, companyName: current.companyName };
  }
  if (!isValidMarketplaceGuestToken(token)) return null;

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
  if (!isValidMarketplaceGuestToken(token)) {
    return { ok: false as const, code: "invalid" };
  }

  const current = await suppressMarketplaceGuestRecipient(token);
  if (current.ok || current.code !== "invalid") return current;

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

  return suppressMarketplaceGuestRecipientIdentity(sql, {
    invitationId: String(row.invitation_id),
    profileId: String(row.profile_id),
    recipientEmail: normalizeMarketplaceRecipientEmail(String(row.recipient_email_normalized)),
  });
}
