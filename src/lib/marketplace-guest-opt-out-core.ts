import "server-only";

import { getSql } from "@/lib/db/server";

const MARKETPLACE_GUEST_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,200}$/;

export function isValidMarketplaceGuestToken(token: string) {
  return MARKETPLACE_GUEST_TOKEN_PATTERN.test(token);
}

export function normalizeMarketplaceRecipientEmail(value: string) {
  return value.trim().toLowerCase();
}

type MarketplaceSql = NonNullable<ReturnType<typeof getSql>>;

export async function suppressMarketplaceGuestRecipientIdentity(
  sql: MarketplaceSql,
  input: {
    profileId: string;
    invitationId: string;
    recipientEmail: string;
  },
) {
  const email = normalizeMarketplaceRecipientEmail(input.recipientEmail);

  await sql.transaction([
    sql`
      insert into marketplace_outreach_suppressions (
        profile_id, email_normalized, reason, source_invitation_id
      ) values (
        ${input.profileId}::uuid, ${email}, 'recipient_opt_out', ${input.invitationId}::uuid
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
