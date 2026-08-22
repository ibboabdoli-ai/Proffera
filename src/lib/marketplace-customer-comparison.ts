import "server-only";

import { createHash, createHmac, randomUUID } from "node:crypto";

import { sendMarketplaceCustomerComparisonEmail } from "@/features/email/marketplace-customer-comparison-email";
import { resolveCustomerPortalSecret } from "@/lib/auth-secret";
import { getSql } from "@/lib/db/server";
import { hashMarketplaceGuestToken } from "@/lib/marketplace-guest-quote";
import { isValidMarketplaceGuestToken } from "@/lib/marketplace-guest-opt-out-core";

const CUSTOMER_COMPARISON_TTL_DAYS = 30;
const CUSTOMER_COMPARISON_TOKEN_CONTEXT = "proffera:marketplace-customer-comparison:v1";
const customerComparisonTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REDACTED_CONTACT = "[…]";

export type MarketplaceCustomerComparisonOffer = {
  id: string;
  companyName: string;
  profileSlug: string;
  status: "submitted" | "selected" | "rejected";
  priceKind: "fixed" | "estimate" | "inspection_required";
  currency: string;
  amountMinor: number;
  availableDate: string;
  companyNote: string;
  directContactRedacted: boolean;
  submittedAt: string;
  rating: number | null;
  reviewCount: number;
  providerEmail: string;
};

export type MarketplaceCustomerComparisonView = {
  quoteReferenceId: string;
  serviceType: string;
  city: string;
  preferredDate: string;
  quoteStatus: string;
  selectedOfferId: string;
  offers: MarketplaceCustomerComparisonOffer[];
};

export function deriveMarketplaceCustomerComparisonToken(input: {
  quoteRequestId: string;
  dispatchToken: string;
  secret: string;
}) {
  if (!uuidPattern.test(input.quoteRequestId) || !uuidPattern.test(input.dispatchToken) || !input.secret) {
    throw new Error("Invalid Marketplace customer comparison token input");
  }
  return createHmac("sha256", input.secret)
    .update(`${CUSTOMER_COMPARISON_TOKEN_CONTEXT}:${input.quoteRequestId}:${input.dispatchToken}`)
    .digest("base64url");
}

export function isMarketplaceCustomerComparisonToken(value: string) {
  return customerComparisonTokenPattern.test(value);
}

export function hashMarketplaceCustomerComparisonToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function marketplaceCustomerComparisonPath(token: string) {
  return `/offert/jamfor/${encodeURIComponent(token)}`;
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function nullableRating(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function redactDirectContact(value: string) {
  return value
    .replace(/[^\s<>()@,;:"']+@[^\s<>()@,;:"']+\.[^\s<>()@,;:"']+/gu, REDACTED_CONTACT)
    .replace(/(?<![\p{L}\p{N}])(?:\+\d{1,3}|00\d{1,3}|0)(?:[\s().-]*\d){6,14}(?!\d)/gu, REDACTED_CONTACT)
    .replace(/\b(?:https?:\/\/|www\.)[^\s<>()]+/giu, REDACTED_CONTACT)
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function customerVisibleMarketplaceOfferNote(value: unknown, contactUnlocked: boolean) {
  const note = text(value).trim();
  if (contactUnlocked) return { note, redacted: false };
  const redacted = redactDirectContact(note);
  return { note: redacted, redacted: redacted !== note };
}

function comparisonBaseUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export async function notifyMarketplaceCustomerOfferAvailableFromGuestToken(input: {
  guestToken: string;
  baseUrl: string;
}) {
  if (!isValidMarketplaceGuestToken(input.guestToken)) {
    return { ok: false as const, code: "invalid_guest_token" };
  }
  const baseUrl = comparisonBaseUrl(input.baseUrl);
  if (!baseUrl) return { ok: false as const, code: "invalid_base_url" };
  const comparisonSecret = resolveCustomerPortalSecret();
  if (!comparisonSecret) return { ok: false as const, code: "configuration" };

  const sql = getSql();
  if (!sql) return { ok: false as const, code: "database" };
  const guestTokenHash = hashMarketplaceGuestToken(input.guestToken);

  const requestRows = await sql`
    select
      request.id::text as quote_request_id,
      request.reference_id,
      request.contact_name,
      request.contact_email
    from marketplace_quote_invitations invitation
    join quote_requests request on request.id = invitation.quote_request_id
    where invitation.token_hash = ${guestTokenHash}
      and request.status = 'answered'
      and nullif(btrim(request.contact_email), '') is not null
      and exists (
        select 1
        from marketplace_quote_offers offer
        where offer.quote_request_id = request.id
          and offer.status = 'submitted'
      )
    limit 1
  `;
  const requestRow = requestRows[0];
  if (!requestRow) return { ok: false as const, code: "request_not_ready" };

  const quoteRequestId = text(requestRow.quote_request_id);
  if (!uuidPattern.test(quoteRequestId)) return { ok: false as const, code: "database" };

  const freshDispatchToken: string = randomUUID();
  const freshToken = deriveMarketplaceCustomerComparisonToken({
    quoteRequestId,
    dispatchToken: freshDispatchToken,
    secret: comparisonSecret,
  });
  const freshTokenHash = hashMarketplaceCustomerComparisonToken(freshToken);
  const freshExpiresAt = new Date(Date.now() + CUSTOMER_COMPARISON_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let reservation = await sql`
    insert into marketplace_quote_customer_access (
      quote_request_id, token_hash, status, dispatch_token, expires_at
    ) values (
      ${quoteRequestId}::uuid, ${freshTokenHash}, 'sending', ${freshDispatchToken}::uuid, ${freshExpiresAt}::timestamptz
    )
    on conflict (quote_request_id) do nothing
    returning quote_request_id::text, token_hash, dispatch_token::text, expires_at::text
  `;

  if (!reservation[0]) {
    reservation = await sql`
      update marketplace_quote_customer_access
      set status = 'sending',
          expires_at = greatest(expires_at, ${freshExpiresAt}::timestamptz),
          sent_at = null,
          provider_message_id = '',
          updated_at = now()
      where quote_request_id = ${quoteRequestId}::uuid
        and dispatch_token is not null
        and (
          status = 'delivery_failed'
          or (status = 'sending' and updated_at <= now() - interval '5 minutes')
        )
      returning quote_request_id::text, token_hash, dispatch_token::text, expires_at::text
    `;
  }

  if (!reservation[0]) {
    // Rotate an expired delivered link BEFORE the email call. If the transport
    // times out after Brevo accepted the request, the delivered link is already
    // valid. A retry can derive the same raw token from the persisted dispatch id.
    reservation = await sql`
      update marketplace_quote_customer_access
      set token_hash = ${freshTokenHash},
          status = 'sending',
          dispatch_token = ${freshDispatchToken}::uuid,
          expires_at = ${freshExpiresAt}::timestamptz,
          sent_at = null,
          provider_message_id = '',
          updated_at = now()
      where quote_request_id = ${quoteRequestId}::uuid
        and status = 'sent'
        and expires_at <= now()
      returning quote_request_id::text, token_hash, dispatch_token::text, expires_at::text
    `;
  }

  if (!reservation[0]) {
    const existingRows = await sql`
      select status, expires_at::text
      from marketplace_quote_customer_access
      where quote_request_id = ${quoteRequestId}::uuid
      limit 1
    `;
    const status = text(existingRows[0]?.status);
    return {
      ok: true as const,
      code: status === "sent" ? "already_sent" : "already_sending",
    };
  }

  const dispatchToken = text(reservation[0]?.dispatch_token) || freshDispatchToken;
  if (!uuidPattern.test(dispatchToken)) return { ok: false as const, code: "database" };
  const comparisonToken = deriveMarketplaceCustomerComparisonToken({
    quoteRequestId,
    dispatchToken,
    secret: comparisonSecret,
  });
  const comparisonTokenHash = hashMarketplaceCustomerComparisonToken(comparisonToken);
  const reservedTokenHash = text(reservation[0]?.token_hash);
  if (reservedTokenHash && reservedTokenHash !== comparisonTokenHash) {
    console.error("Marketplace customer comparison token hash does not match its dispatch id", { quoteRequestId });
    return { ok: false as const, code: "database" };
  }

  const comparisonUrl = `${baseUrl}${marketplaceCustomerComparisonPath(comparisonToken)}`;
  const delivery = await sendMarketplaceCustomerComparisonEmail({
    recipientEmail: text(requestRow.contact_email),
    customerName: text(requestRow.contact_name),
    quoteReferenceId: text(requestRow.reference_id),
    comparisonUrl,
    idempotencyKey: dispatchToken,
  });

  if (!delivery.ok && delivery.code === "duplicate") {
    const completed = await sql`
      update marketplace_quote_customer_access
      set status = 'sent',
          sent_at = coalesce(sent_at, now()),
          updated_at = now()
      where quote_request_id = ${quoteRequestId}::uuid
        and status = 'sending'
        and dispatch_token = ${dispatchToken}::uuid
      returning quote_request_id::text
    `;
    if (!completed[0]) {
      console.error("Marketplace customer comparison duplicate delivery state was not recorded", { quoteRequestId });
    }
    return { ok: true as const, code: "already_sent" };
  }

  if (!delivery.ok) {
    await sql`
      update marketplace_quote_customer_access
      set status = 'delivery_failed', updated_at = now()
      where quote_request_id = ${quoteRequestId}::uuid
        and status = 'sending'
        and dispatch_token = ${dispatchToken}::uuid
    `;
    return { ok: false as const, code: `email_${delivery.code}` };
  }

  const completed = await sql`
    update marketplace_quote_customer_access
    set status = 'sent',
        sent_at = now(),
        provider_message_id = ${delivery.providerMessageId ?? ""},
        updated_at = now()
    where quote_request_id = ${quoteRequestId}::uuid
      and status = 'sending'
      and dispatch_token = ${dispatchToken}::uuid
    returning quote_request_id::text
  `;

  if (!completed[0]) {
    console.error("Marketplace customer comparison email delivered but completion state was not recorded", { quoteRequestId });
  }
  return { ok: true as const, code: "sent" };
}

export async function getMarketplaceCustomerComparison(token: string): Promise<MarketplaceCustomerComparisonView | null> {
  if (!isMarketplaceCustomerComparisonToken(token)) return null;
  const sql = getSql();
  if (!sql) return null;
  const tokenHash = hashMarketplaceCustomerComparisonToken(token);

  const requestRows = await sql`
    select
      request.id::text as quote_request_id,
      request.reference_id,
      request.service_type,
      request.city,
      request.preferred_date,
      request.status as quote_status
    from marketplace_quote_customer_access access
    join quote_requests request on request.id = access.quote_request_id
    where access.token_hash = ${tokenHash}
      and access.expires_at > now()
      and request.status in ('answered', 'booked')
    limit 1
  `;
  const requestRow = requestRows[0];
  if (!requestRow) return null;
  const quoteRequestId = text(requestRow.quote_request_id);

  const offerRows = await sql`
    select
      offer.id::text,
      offer.status,
      offer.price_kind,
      offer.currency,
      offer.amount_minor,
      offer.available_date::text,
      offer.company_note,
      offer.submitted_at::text,
      profile.display_name,
      profile.public_slug,
      case when offer.status = 'selected' then invitation.recipient_email else '' end as provider_email,
      review_summary.rating,
      coalesce(review_summary.review_count, 0) as review_count
    from marketplace_quote_offers offer
    join marketplace_quote_invitations invitation on invitation.id = offer.invitation_id
    join company_directory_profiles profile on profile.id = offer.profile_id
    left join lateral (
      select
        round(avg(review.rating)::numeric, 1)::float8 as rating,
        count(*)::int as review_count
      from website_reviews review
      where offer.workspace_id is not null
        and review.workspace_id = offer.workspace_id
        and review.status = 'approved'
    ) review_summary on true
    where offer.quote_request_id = ${quoteRequestId}::uuid
      and offer.status in ('submitted', 'selected', 'rejected')
    order by
      case offer.status when 'selected' then 0 when 'submitted' then 1 else 2 end,
      offer.submitted_at asc,
      offer.id asc
  `;

  const offers = offerRows.map((row) => {
    const status = text(row.status) as MarketplaceCustomerComparisonOffer["status"];
    const note = customerVisibleMarketplaceOfferNote(row.company_note, status === "selected");
    return {
      id: text(row.id),
      companyName: text(row.display_name),
      profileSlug: text(row.public_slug),
      status,
      priceKind: text(row.price_kind) as MarketplaceCustomerComparisonOffer["priceKind"],
      currency: text(row.currency) || "SEK",
      amountMinor: Number(row.amount_minor ?? 0),
      availableDate: text(row.available_date),
      companyNote: note.note,
      directContactRedacted: note.redacted,
      submittedAt: text(row.submitted_at),
      rating: nullableRating(row.rating),
      reviewCount: Number(row.review_count ?? 0),
      providerEmail: status === "selected" ? text(row.provider_email) : "",
    } satisfies MarketplaceCustomerComparisonOffer;
  });

  const selectedOfferId = offers.find((offer) => offer.status === "selected")?.id ?? "";
  return {
    quoteReferenceId: text(requestRow.reference_id),
    serviceType: text(requestRow.service_type),
    city: text(requestRow.city),
    preferredDate: text(requestRow.preferred_date),
    quoteStatus: text(requestRow.quote_status),
    selectedOfferId,
    offers,
  };
}

export async function selectMarketplaceCustomerOffer(token: string, offerId: string) {
  if (!isMarketplaceCustomerComparisonToken(token) || !uuidPattern.test(offerId)) {
    return { ok: false as const, code: "invalid" };
  }
  const sql = getSql();
  if (!sql) return { ok: false as const, code: "database" };
  const tokenHash = hashMarketplaceCustomerComparisonToken(token);

  try {
    const rows = await sql`
      with customer_access as (
        select access.quote_request_id
        from marketplace_quote_customer_access access
        join quote_requests request on request.id = access.quote_request_id
        where access.token_hash = ${tokenHash}
          and access.expires_at > now()
          and request.status = 'answered'
        for update of access, request
      ), selected_offer as (
        update marketplace_quote_offers offer
        set status = 'selected',
            selected_at = now(),
            rejected_at = null,
            updated_at = now()
        from customer_access access
        where offer.id = ${offerId}::uuid
          and offer.quote_request_id = access.quote_request_id
          and offer.status = 'submitted'
          and not exists (
            select 1
            from marketplace_quote_offers existing
            where existing.quote_request_id = access.quote_request_id
              and existing.status = 'selected'
          )
        returning offer.id, offer.quote_request_id, offer.invitation_id
      ), rejected_offers as (
        update marketplace_quote_offers offer
        set status = 'rejected', rejected_at = now(), updated_at = now()
        from selected_offer selected
        where offer.quote_request_id = selected.quote_request_id
          and offer.id <> selected.id
          and offer.status = 'submitted'
        returning offer.id
      ), cancelled_open_invitations as (
        update marketplace_quote_invitations invitation
        set status = 'cancelled', updated_at = now()
        from selected_offer selected
        where invitation.quote_request_id = selected.quote_request_id
          and invitation.id <> selected.invitation_id
          and invitation.status in ('pending', 'sending', 'sent', 'viewed')
        returning invitation.id
      ), extended_winner_access as (
        update marketplace_quote_invitations invitation
        set expires_at = greatest(invitation.expires_at, now() + interval '30 days'),
            updated_at = now()
        from selected_offer selected
        where invitation.id = selected.invitation_id
        returning invitation.id
      ), closed_request as (
        update quote_requests request
        set status = 'booked', updated_at = now()
        from selected_offer selected
        where request.id = selected.quote_request_id
          and request.status = 'answered'
        returning request.id
      )
      select selected.id::text
      from selected_offer selected
      where exists (select 1 from closed_request)
    `;

    if (rows[0]?.id) return { ok: true as const, offerId: text(rows[0].id) };
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code !== "23505") throw error;
  }

  const currentRows = await sql`
    select offer.id::text
    from marketplace_quote_customer_access access
    join marketplace_quote_offers offer on offer.quote_request_id = access.quote_request_id
    where access.token_hash = ${tokenHash}
      and access.expires_at > now()
      and offer.status = 'selected'
    limit 1
  `;
  const selectedId = text(currentRows[0]?.id);
  if (selectedId === offerId) return { ok: true as const, offerId, alreadySelected: true as const };
  if (selectedId) return { ok: false as const, code: "already_selected" };
  return { ok: false as const, code: "closed" };
}
