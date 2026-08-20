import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { businessEmailDomainKind, validBusinessEmail } from "@/lib/company-directory-claim-email";
import { getSql } from "@/lib/db/server";
import { sendMarketplaceGuestInvitationEmail } from "@/features/email/marketplace-guest-invitation-email";

const GUEST_INVITATION_TTL_DAYS = 7;
const ACTIVE_INVITATION_STATUSES = new Set(["pending", "sending", "sent", "viewed", "responded"]);
const SENDABLE_QUOTE_STATUSES = new Set(["submitted", "pending_review", "approved", "matched", "answered"]);
const REDACTED_CONTACT = "[…]";

export type MarketplaceGuestQuoteView = {
  invitationId: string;
  status: string;
  expiresAt: string;
  companyName: string;
  profileSlug: string;
  quoteReferenceId: string;
  category: string;
  serviceType: string;
  city: string;
  postalCode: string;
  description: string;
  preferredDate: string;
  offer: null | {
    priceKind: string;
    currency: string;
    amountMinor: number;
    availableDate: string;
    companyNote: string;
    submittedAt: string;
  };
};

export function normalizeMarketplaceRecipientEmail(value: string) {
  return value.trim().toLowerCase();
}

export function isMarketplaceBusinessRecipientEmail(value: string) {
  const normalized = normalizeMarketplaceRecipientEmail(value);
  return validBusinessEmail(normalized) && businessEmailDomainKind(normalized) === "business_domain";
}

export function createMarketplaceGuestToken() {
  return randomBytes(32).toString("base64url");
}

export function hashMarketplaceGuestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactLiteral(value: string, literal: string) {
  const normalized = literal.trim();
  if (!normalized) return value;
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapeRegExp(normalized)}(?=$|[^\\p{L}\\p{N}])`,
    "giu",
  );
  return value.replace(pattern, (_match, prefix: string) => `${prefix}${REDACTED_CONTACT}`);
}

function redactKnownPhone(value: string, phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return value;

  const variants = new Set([digits]);
  if (digits.startsWith("0046") && digits.length > 10) variants.add(`0${digits.slice(4)}`);
  if (digits.startsWith("46") && digits.length > 8) variants.add(`0${digits.slice(2)}`);

  let redacted = value;
  for (const variant of variants) {
    const flexible = variant.split("").map(escapeRegExp).join("[\\s().-]*");
    redacted = redacted.replace(new RegExp(`(?<!\\d)${flexible}(?!\\d)`, "g"), REDACTED_CONTACT);
  }
  return redacted;
}

function redactPhoneCandidates(value: string) {
  return value.replace(
    /(?<![\p{L}\p{N}])(?:\+\d{1,3}|00\d{1,3}|0)(?:[\s().-]*\d){6,14}(?!\d)/gu,
    (candidate) => {
      const digits = candidate.replace(/\D/g, "");
      return digits.length >= 7 && digits.length <= 15 ? REDACTED_CONTACT : candidate;
    },
  );
}

export function redactMarketplaceGuestDescription(
  description: unknown,
  contact: { name?: unknown; email?: unknown; phone?: unknown },
) {
  let redacted = String(description ?? "");
  const email = String(contact.email ?? "").trim();
  const phone = String(contact.phone ?? "").trim();
  const fullName = String(contact.name ?? "").trim();

  if (email) redacted = redactLiteral(redacted, email);
  redacted = redacted.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTED_CONTACT);

  if (phone) {
    redacted = redactLiteral(redacted, phone);
    redacted = redactKnownPhone(redacted, phone);
  }
  redacted = redactPhoneCandidates(redacted);

  if (fullName) {
    redacted = redactLiteral(redacted, fullName);
    const nameParts = fullName.split(/\s+/).filter((part) => part.length >= 4);
    for (const part of nameParts) redacted = redactLiteral(redacted, part);
  }

  return redacted.replace(/[ \t]{2,}/g, " ").trim();
}

export function buildMarketplaceGuestQuoteView(
  row: Record<string, unknown>,
  expiresAt: string,
  expired: boolean,
): MarketplaceGuestQuoteView {
  const hasOffer = Boolean(row.price_kind);
  return {
    invitationId: String(row.invitation_id),
    status: expired && !["responded", "suppressed"].includes(String(row.status)) ? "expired" : String(row.status),
    expiresAt,
    companyName: String(row.display_name),
    profileSlug: String(row.public_slug),
    quoteReferenceId: String(row.reference_id),
    category: String(row.category),
    serviceType: String(row.service_type),
    city: String(row.city),
    postalCode: String(row.postal_code ?? ""),
    description: redactMarketplaceGuestDescription(row.description, {
      name: row.contact_name,
      email: row.contact_email,
      phone: row.contact_phone,
    }),
    preferredDate: String(row.preferred_date ?? ""),
    offer: hasOffer ? {
      priceKind: String(row.price_kind),
      currency: String(row.currency),
      amountMinor: Number(row.amount_minor ?? 0),
      availableDate: String(row.available_date ?? ""),
      companyNote: String(row.company_note ?? ""),
      submittedAt: String(row.submitted_at ?? ""),
    } : null,
  };
}

function safeProviderMessage(value: unknown) {
  const message = String(value ?? "").slice(0, 240);
  return message.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]");
}

function databaseErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") {
    return { code: "", message: String(error ?? "") };
  }
  const candidate = error as { code?: unknown; message?: unknown };
  return {
    code: String(candidate.code ?? ""),
    message: String(candidate.message ?? ""),
  };
}

function validToken(token: string) {
  return /^[A-Za-z0-9_-]{32,200}$/.test(token);
}

function boundedScore(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function boundedWave(value: unknown) {
  return Number(value) === 2 ? 2 : 1;
}

function safeReasons(value: unknown) {
  if (!Array.isArray(value)) return ["admin_selected"];
  return value
    .map((item) => String(item ?? "").trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 8);
}

export async function sendMarketplaceGuestQuoteInvitation(input: {
  quoteRequestId: string;
  profileId: string;
  recipientEmail: string;
  adminUserId: string;
  baseUrl: string;
  wave?: number;
  matchScore?: number;
  matchReasons?: string[];
}) {
  const sql = getSql();
  if (!sql) return { ok: false as const, code: "database" };

  const recipientEmail = normalizeMarketplaceRecipientEmail(input.recipientEmail);
  if (!isMarketplaceBusinessRecipientEmail(recipientEmail)) {
    return { ok: false as const, code: "business_email_required" };
  }

  const rows = await sql`
    select
      q.id::text as quote_request_id,
      q.reference_id,
      q.category,
      q.service_type,
      q.city,
      q.preferred_date,
      q.status as quote_status,
      q.consent_accepted,
      p.id::text as profile_id,
      p.public_slug,
      p.display_name,
      p.publication_status,
      p.is_active,
      p.privacy_blocked,
      p.organization_kind,
      p.claimed_workspace_id::text as claimed_workspace_id
    from quote_requests q
    join company_directory_profiles p on p.id = ${input.profileId}::uuid
    where q.id = ${input.quoteRequestId}::uuid
    limit 1
  `;
  const row = rows[0];
  if (!row) return { ok: false as const, code: "not_found" };

  if (!SENDABLE_QUOTE_STATUSES.has(String(row.quote_status))) {
    return { ok: false as const, code: "quote_closed" };
  }
  if (!Boolean(row.consent_accepted)) {
    return { ok: false as const, code: "consent_required" };
  }
  if (
    String(row.publication_status) !== "published"
    || !Boolean(row.is_active)
    || Boolean(row.privacy_blocked)
    || String(row.organization_kind) !== "juridical_person"
    || Boolean(row.claimed_workspace_id)
  ) {
    return { ok: false as const, code: "profile_ineligible" };
  }

  const suppressionRows = await sql`
    select id
    from marketplace_outreach_suppressions
    where email_normalized = ${recipientEmail}
    limit 1
  `;
  if (suppressionRows[0]) return { ok: false as const, code: "suppressed" };

  const existingRows = await sql`
    select
      id::text,
      status,
      (status = 'sending' and updated_at <= now() - interval '5 minutes') as stale_sending
    from marketplace_quote_invitations
    where quote_request_id = ${input.quoteRequestId}::uuid
      and profile_id = ${input.profileId}::uuid
    limit 1
  `;
  const existing = existingRows[0];
  const staleSending = Boolean(existing?.stale_sending);
  if (existing && ACTIVE_INVITATION_STATUSES.has(String(existing.status)) && !staleSending) {
    return { ok: false as const, code: "already_invited" };
  }
  if (existing && String(existing.status) === "suppressed") {
    return { ok: false as const, code: "suppressed" };
  }

  const token = createMarketplaceGuestToken();
  const tokenHash = hashMarketplaceGuestToken(token);
  const expiresAt = new Date(Date.now() + GUEST_INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const matchScore = boundedScore(input.matchScore);
  const wave = boundedWave(input.wave);
  const matchReasons = safeReasons(input.matchReasons);

  let invitationId = "";
  try {
    if (existing) {
      const updated = await sql`
        update marketplace_quote_invitations
        set recipient_email = ${recipientEmail},
            token_hash = ${tokenHash},
            status = 'sending',
            wave = ${wave},
            match_score = ${matchScore},
            match_reasons = ${JSON.stringify(matchReasons)}::jsonb,
            contact_basis = 'manual_business_contact',
            expires_at = ${expiresAt}::timestamptz,
            sent_at = null,
            viewed_at = null,
            responded_at = null,
            declined_at = null,
            provider_message_id = '',
            created_by_admin_user_id = ${input.adminUserId},
            updated_at = now()
        where id = ${String(existing.id)}::uuid
          and (
            status in ('delivery_failed', 'expired', 'declined', 'cancelled')
            or (status = 'sending' and updated_at <= now() - interval '5 minutes')
          )
        returning id::text
      `;
      invitationId = String(updated[0]?.id ?? "");
    } else {
      const inserted = await sql`
        insert into marketplace_quote_invitations (
          quote_request_id, profile_id, recipient_email, token_hash, status,
          wave, match_score, match_reasons, contact_basis, expires_at,
          created_by_admin_user_id
        ) values (
          ${input.quoteRequestId}::uuid, ${input.profileId}::uuid, ${recipientEmail}, ${tokenHash}, 'sending',
          ${wave}, ${matchScore}, ${JSON.stringify(matchReasons)}::jsonb, 'manual_business_contact', ${expiresAt}::timestamptz,
          ${input.adminUserId}
        )
        on conflict (quote_request_id, profile_id) do nothing
        returning id::text
      `;
      invitationId = String(inserted[0]?.id ?? "");
    }
  } catch (error) {
    const details = databaseErrorDetails(error);
    if (details.code === "23514" && details.message.includes("marketplace_recipient_suppressed")) {
      return { ok: false as const, code: "suppressed" };
    }
    if (details.code === "23514" && details.message.includes("marketplace_quote_closed")) {
      return { ok: false as const, code: "quote_closed" };
    }
    if (details.code === "23514" && details.message.includes("marketplace_consent_required")) {
      return { ok: false as const, code: "consent_required" };
    }
    throw error;
  }
  if (!invitationId) return { ok: false as const, code: existing ? "conflict" : "already_invited" };

  // Atomically claim provider dispatch. Migration 0050 makes this sending ->
  // pending transition acquire the same normalized-email advisory lock as a
  // permanent opt-out. The provider call starts only after this claim commits.
  let dispatchRows;
  try {
    dispatchRows = await sql`
      update marketplace_quote_invitations invitation
      set status = 'pending', updated_at = now()
      where invitation.id = ${invitationId}::uuid
        and invitation.status = 'sending'
        and not exists (
          select 1
          from marketplace_outreach_suppressions suppression
          where suppression.email_normalized = lower(btrim(invitation.recipient_email))
        )
      returning invitation.id::text
    `;
  } catch (error) {
    const details = databaseErrorDetails(error);
    if (details.code === "23514" && details.message.includes("marketplace_recipient_suppressed")) {
      return { ok: false as const, code: "suppressed" };
    }
    if (details.code === "23514" && details.message.includes("marketplace_quote_closed")) {
      return { ok: false as const, code: "quote_closed" };
    }
    if (details.code === "23514" && details.message.includes("marketplace_consent_required")) {
      return { ok: false as const, code: "consent_required" };
    }
    throw error;
  }
  if (!dispatchRows[0]?.id) {
    const stateRows = await sql`
      select status
      from marketplace_quote_invitations
      where id = ${invitationId}::uuid
      limit 1
    `;
    return {
      ok: false as const,
      code: String(stateRows[0]?.status) === "suppressed" ? "suppressed" : "conflict",
    };
  }

  const baseUrl = input.baseUrl.replace(/\/$/, "");
  const replyUrl = `${baseUrl}/offert/svara/${encodeURIComponent(token)}`;
  const optOutUrl = `${replyUrl}/avregistrera`;
  const delivery = await sendMarketplaceGuestInvitationEmail({
    recipientEmail,
    companyName: String(row.display_name),
    quoteReferenceId: String(row.reference_id),
    category: String(row.category),
    serviceType: String(row.service_type),
    city: String(row.city),
    preferredDate: String(row.preferred_date ?? ""),
    replyUrl,
    optOutUrl,
  });

  if (!delivery.ok) {
    console.error("Marketplace guest invitation delivery failed", {
      invitationId,
      code: delivery.code,
      providerMessage: "message" in delivery ? safeProviderMessage(delivery.message) : "",
    });
    try {
      await sql`
        update marketplace_quote_invitations invitation
        set status = case
              when exists (
                select 1 from marketplace_outreach_suppressions suppression
                where suppression.email_normalized = lower(btrim(invitation.recipient_email))
              ) then 'suppressed'
              else 'delivery_failed'
            end,
            updated_at = now()
        where invitation.id = ${invitationId}::uuid and invitation.status = 'pending'
      `;
    } catch (error) {
      console.error("Failed to record marketplace guest invitation delivery failure", { invitationId, error });
    }
    return { ok: false as const, code: `email_${delivery.code}` };
  }

  let sentStatusRecorded = false;
  try {
    const sentRows = await sql`
      update marketplace_quote_invitations invitation
      set status = case
            when exists (
              select 1 from marketplace_outreach_suppressions suppression
              where suppression.email_normalized = lower(btrim(invitation.recipient_email))
            ) then 'suppressed'
            else 'sent'
          end,
          sent_at = now(),
          provider_message_id = ${delivery.providerMessageId ?? ""},
          updated_at = now()
      where invitation.id = ${invitationId}::uuid and invitation.status = 'pending'
      returning id::text
    `;
    sentStatusRecorded = Boolean(sentRows[0]?.id);
    if (!sentStatusRecorded) {
      console.error("Marketplace guest invitation was delivered but sent status was not updated", { invitationId });
    }
  } catch (error) {
    console.error("Marketplace guest invitation was delivered but sent status update failed", { invitationId, error });
  }

  try {
    await sql`
      insert into admin_audit_logs (
        admin_user_id, action, reason, new_value
      ) values (
        ${input.adminUserId},
        'marketplace.guest_quote_invited',
        'Quote Admin sent a guest marketplace invitation to an unclaimed company profile',
        ${JSON.stringify({
          invitation_id: invitationId,
          quote_request_id: input.quoteRequestId,
          profile_id: input.profileId,
          recipient_email: recipientEmail,
          wave,
          sent_status_recorded: sentStatusRecorded,
        })}::jsonb
      )
    `;
  } catch (error) {
    console.error("Marketplace guest invitation was delivered but audit logging failed", { invitationId, error });
  }

  return { ok: true as const, invitationId };
}

async function loadGuestQuoteView(
  token: string,
  options?: { markViewed?: boolean; allowExpired?: boolean; allowClosed?: boolean },
) {
  if (!validToken(token)) return null;
  const sql = getSql();
  if (!sql) return null;
  const tokenHash = hashMarketplaceGuestToken(token);

  const rows = await sql`
    select
      i.id::text as invitation_id,
      i.status,
      i.expires_at::text,
      p.display_name,
      p.public_slug,
      q.reference_id,
      q.category,
      q.service_type,
      q.city,
      q.postal_code,
      q.description,
      q.contact_name,
      q.contact_email,
      q.contact_phone,
      q.preferred_date,
      q.status as quote_status,
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

  const quoteOpen = SENDABLE_QUOTE_STATUSES.has(String(row.quote_status));
  if (!quoteOpen && !options?.allowClosed) return null;

  const expiresAt = new Date(String(row.expires_at));
  const validExpiresAt = Number.isFinite(expiresAt.getTime());
  const expired = !validExpiresAt || expiresAt.getTime() <= Date.now();
  if (expired && String(row.status) !== "responded" && String(row.status) !== "suppressed") {
    await sql`
      update marketplace_quote_invitations
      set status = 'expired', updated_at = now()
      where id = ${String(row.invitation_id)}::uuid
        and status in ('pending', 'sending', 'sent', 'viewed', 'delivery_failed')
    `;
    if (!options?.allowExpired) return null;
  }

  if (quoteOpen && options?.markViewed && String(row.status) === "sent" && !expired) {
    await sql`
      update marketplace_quote_invitations
      set status = 'viewed', viewed_at = coalesce(viewed_at, now()), updated_at = now()
      where id = ${String(row.invitation_id)}::uuid and status = 'sent'
    `;
    row.status = "viewed";
  }

  return buildMarketplaceGuestQuoteView(
    row as Record<string, unknown>,
    validExpiresAt ? expiresAt.toISOString() : "",
    expired,
  );
}

export async function getMarketplaceGuestQuoteView(token: string) {
  return loadGuestQuoteView(token, { markViewed: true });
}

export async function getMarketplaceGuestOptOutView(token: string) {
  return loadGuestQuoteView(token, { allowExpired: true, allowClosed: true });
}

export async function submitMarketplaceGuestQuote(input: {
  token: string;
  priceKind: "fixed" | "estimate" | "inspection_required";
  amountMinor: number;
  availableDate: string | null;
  companyNote: string;
}) {
  const sql = getSql();
  if (!sql || !validToken(input.token)) return { ok: false as const, code: "invalid" };
  const tokenHash = hashMarketplaceGuestToken(input.token);
  const rows = await sql`
    select
      i.id::text as invitation_id,
      i.quote_request_id::text,
      i.profile_id::text,
      i.workspace_id::text,
      i.status,
      i.expires_at::text,
      q.status as quote_status
    from marketplace_quote_invitations i
    join quote_requests q on q.id = i.quote_request_id
    where i.token_hash = ${tokenHash}
    limit 1
  `;
  const row = rows[0];
  if (!row) return { ok: false as const, code: "invalid" };
  if (!SENDABLE_QUOTE_STATUSES.has(String(row.quote_status))) {
    return { ok: false as const, code: "closed" };
  }
  if (["suppressed", "declined", "cancelled", "expired"].includes(String(row.status))) {
    return { ok: false as const, code: "closed" };
  }
  const expiresAt = new Date(String(row.expires_at));
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
    await sql`
      update marketplace_quote_invitations
      set status = 'expired', updated_at = now()
      where id = ${String(row.invitation_id)}::uuid and status in ('pending', 'sending', 'sent', 'viewed')
    `;
    return { ok: false as const, code: "expired" };
  }
  if (String(row.status) === "responded") return { ok: false as const, code: "already_responded" };

  const amountMinor = Math.max(0, Math.min(1_000_000_000, Math.round(input.amountMinor)));
  if (input.priceKind !== "inspection_required" && amountMinor <= 0) {
    return { ok: false as const, code: "invalid_amount" };
  }
  const companyNote = input.companyNote.trim().slice(0, 4000);
  const availableDate = input.availableDate && /^\d{4}-\d{2}-\d{2}$/.test(input.availableDate)
    ? input.availableDate
    : null;

  let inserted;
  try {
    inserted = await sql`
      with submitted_offer as (
        insert into marketplace_quote_offers (
          invitation_id, quote_request_id, profile_id, workspace_id,
          status, price_kind, currency, amount_minor, available_date, company_note
        ) values (
          ${String(row.invitation_id)}::uuid,
          ${String(row.quote_request_id)}::uuid,
          ${String(row.profile_id)}::uuid,
          ${String(row.workspace_id || "") || null}::uuid,
          'submitted', ${input.priceKind}, 'SEK', ${amountMinor}, ${availableDate}::date, ${companyNote}
        )
        on conflict (invitation_id) do nothing
        returning id, invitation_id, quote_request_id
      ), marked_invitation as (
        update marketplace_quote_invitations invitation
        set status = 'responded', responded_at = now(), updated_at = now()
        from submitted_offer offer
        where invitation.id = offer.invitation_id
        returning invitation.id
      ), marked_request as (
        update quote_requests request
        set status = 'answered', updated_at = now()
        from submitted_offer offer
        where request.id = offer.quote_request_id
          and request.status in ('submitted', 'pending_review', 'approved', 'matched', 'answered')
        returning request.id
      )
      select id::text from submitted_offer
    `;
  } catch (error) {
    const details = databaseErrorDetails(error);
    if (
      details.code === "23514"
      && (details.message.includes("marketplace_quote_closed")
        || details.message.includes("marketplace_recipient_suppressed"))
    ) {
      return { ok: false as const, code: "closed" };
    }
    throw error;
  }
  if (!inserted[0]?.id) return { ok: false as const, code: "already_responded" };

  return { ok: true as const, offerId: String(inserted[0].id) };
}

export async function suppressMarketplaceGuestRecipient(token: string) {
  const sql = getSql();
  if (!sql || !validToken(token)) return { ok: false as const, code: "invalid" };
  const tokenHash = hashMarketplaceGuestToken(token);
  const rows = await sql`
    select id::text, profile_id::text, lower(btrim(recipient_email)) as recipient_email
    from marketplace_quote_invitations
    where token_hash = ${tokenHash}
    limit 1
  `;
  const row = rows[0];
  if (!row) return { ok: false as const, code: "invalid" };
  const email = normalizeMarketplaceRecipientEmail(String(row.recipient_email));

  await sql.transaction([
    sql`
      insert into marketplace_outreach_suppressions (
        profile_id, email_normalized, reason, source_invitation_id
      ) values (
        ${String(row.profile_id)}::uuid, ${email}, 'recipient_opt_out', ${String(row.id)}::uuid
      )
      on conflict (email_normalized) do nothing
    `,
    sql`
      update marketplace_quote_invitations
      set status = 'suppressed', updated_at = now()
      where lower(btrim(recipient_email)) = ${email}
        and status in ('sending', 'sent', 'viewed', 'delivery_failed', 'expired')
    `,
  ]);

  const dispatchRows = await sql`
    select id
    from marketplace_quote_invitations
    where lower(btrim(recipient_email)) = ${email}
      and status = 'pending'
    limit 1
  `;
  if (dispatchRows[0]) {
    return { ok: false as const, code: "dispatch_in_progress" };
  }

  return { ok: true as const };
}