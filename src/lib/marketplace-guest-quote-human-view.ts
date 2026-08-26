import "server-only";

import { getSql } from "@/lib/db/server";
import {
  buildMarketplaceGuestQuoteView,
  hashMarketplaceGuestToken,
  submitMarketplaceGuestQuote as submitMarketplaceGuestQuoteCore,
  type MarketplaceGuestQuoteView,
} from "@/lib/marketplace-guest-quote";
import { isValidMarketplaceGuestToken } from "@/lib/marketplace-guest-opt-out-core";
import { isQuoteRequestOpenForMatchingOrDelivery } from "@/lib/quote-request-lifecycle";

export type MarketplaceGuestQuoteHumanView = MarketplaceGuestQuoteView & {
  customerContact: null | {
    name: string;
    email: string;
    phone: string;
    addressLine1: string;
    city: string;
    postalCode: string;
  };
};

export async function getMarketplaceGuestQuoteView(token: string): Promise<MarketplaceGuestQuoteHumanView | null> {
  if (!isValidMarketplaceGuestToken(token)) return null;
  const sql = getSql();
  if (!sql) return null;
  const tokenHash = hashMarketplaceGuestToken(token);

  const rows = await sql`
    select
      i.id::text as invitation_id,
      i.status,
      i.expires_at::text,
      exists (
        select 1
        from marketplace_outreach_suppressions suppression
        where suppression.email_normalized = lower(btrim(i.recipient_email))
      ) as recipient_suppressed,
      p.display_name,
      p.public_slug,
      q.reference_id,
      q.category,
      q.service_type,
      q.city,
      q.postal_code,
      q.customer_address_line1,
      q.description,
      q.contact_name,
      q.contact_email,
      q.contact_phone,
      q.preferred_date,
      q.status as quote_status,
      o.status as offer_status,
      o.price_kind,
      o.currency,
      o.amount_minor,
      o.available_date::text,
      o.company_note,
      o.submitted_at::text
    from marketplace_quote_invitations i
    join quote_requests q on q.id = i.quote_request_id
    join company_directory_profiles p on p.id = i.profile_id
    left join marketplace_quote_offers o on o.invitation_id = i.id
    where i.token_hash = ${tokenHash}
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  if (Boolean(row.recipient_suppressed)) row.status = "suppressed";

  const winnerSelected = String(row.offer_status) === "selected";
  const quoteOpen = isQuoteRequestOpenForMatchingOrDelivery(String(row.quote_status));
  if (!quoteOpen && !winnerSelected) return null;

  const expiresAt = new Date(String(row.expires_at));
  const validExpiresAt = Number.isFinite(expiresAt.getTime());
  const expired = !validExpiresAt || expiresAt.getTime() <= Date.now();
  if (expired && winnerSelected) return null;
  if (expired && String(row.status) !== "responded" && String(row.status) !== "suppressed") {
    await sql`
      update marketplace_quote_invitations
      set status = 'expired', updated_at = now()
      where id = ${String(row.invitation_id)}::uuid
        and status in ('pending', 'sending', 'sent', 'viewed', 'delivery_failed')
    `;
    return null;
  }

  // GET rendering must not count as a human view. Mail security scanners such as
  // Microsoft Safe Links prefetch signed URLs, so sent -> viewed on GET creates
  // false positives.
  const view = buildMarketplaceGuestQuoteView(
    row as Record<string, unknown>,
    validExpiresAt ? expiresAt.toISOString() : "",
    expired,
  );

  return {
    ...view,
    customerContact: winnerSelected ? {
      name: String(row.contact_name ?? ""),
      email: String(row.contact_email ?? ""),
      phone: String(row.contact_phone ?? ""),
      addressLine1: String(row.customer_address_line1 ?? ""),
      city: String(row.city ?? ""),
      postalCode: String(row.postal_code ?? ""),
    } : null,
  };
}

export async function submitMarketplaceGuestQuote(
  input: Parameters<typeof submitMarketplaceGuestQuoteCore>[0],
) {
  const result = await submitMarketplaceGuestQuoteCore(input);
  if (!result.ok || !isValidMarketplaceGuestToken(input.token)) return result;

  const sql = getSql();
  if (!sql) return result;
  const tokenHash = hashMarketplaceGuestToken(input.token);

  try {
    // A successful quote response is unambiguous human interaction. Backfill the
    // human-view timestamp for analytics without relying on scanner-prone GETs.
    await sql`
      update marketplace_quote_invitations
      set viewed_at = coalesce(viewed_at, now()), updated_at = now()
      where token_hash = ${tokenHash}
        and status = 'responded'
    `;
  } catch (error) {
    console.error("Failed to backfill marketplace guest human view", { error });
  }

  return result;
}
