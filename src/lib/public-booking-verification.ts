import "server-only";

import { createHash, randomInt } from "node:crypto";

import { sendBookingOwnerNotificationEmail } from "@/features/email/lead-email";
import { sendBookingVerificationEmail } from "@/features/email/booking-verification-email";
import { sendUnifiedBookingConfirmationEmail } from "@/features/email/unified-booking-confirmation-email";
import { sendBookingOwnerSms, sendBookingVerificationSms } from "@/features/sms/booking-sms";
import { createCustomerCalendarToken } from "@/lib/customer-calendar";
import { resolveAuthSecret } from "@/lib/auth-secret";
import { getSql } from "@/lib/db/server";
import { finalizeMariaVerifiedBooking } from "@/lib/maria-verified-booking";
import { getMariaBookingReadiness } from "@/lib/maria-booking-runtime";
import { renewMariaPreviewHoldForResend } from "@/lib/maria-resend-hold";
import { getMariaBookingPortalBase, isMariaBookingRecipientAllowed, isMariaPreviewTestRecipient } from "@/lib/maria-preview-customer-safety";
import type { WorkspaceTimeZone } from "@/lib/workspace-market";

const EXPIRY_MINUTES = 10;
const DAY_SECONDS = 60 * 60 * 24;
const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i;
const LEGACY_PRIMEVIEW_PROPERTY_TYPES = new Set(["House", "Flat", "Commercial"]);

/** Trim an address field and collapse repeated whitespace. */
function cleanAddressPart(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

/** Read one labelled value from a newline-separated booking-details field. */
function bookingDetailValue(bookingDetails: string, label: string) {
  const prefix = `${label.toLowerCase()}:`;
  const line = bookingDetails
    .split(/\r?\n/)
    .map((value) => value.trim())
    .find((value) => value.toLowerCase().startsWith(prefix));
  return line ? cleanAddressPart(line.slice(prefix.length)) : "";
}

/** Require expected address parts for a PrimeView property type before verification. */
export function validatePrimeViewServiceAddress(input: { address?: string; postcode?: string; bookingDetails?: string }) {
  const propertyType = bookingDetailValue(input.bookingDetails ?? "", "Property type");
  if (!propertyType) return false;

  const address = cleanAddressPart(input.address ?? "");
  if (LEGACY_PRIMEVIEW_PROPERTY_TYPES.has(propertyType)) return Boolean(address);

  const postcode = cleanAddressPart(input.postcode ?? "").toUpperCase();
  if (!UK_POSTCODE.test(postcode)) return false;

  const parts = address
    .split(",")
    .map(cleanAddressPart)
    .filter(Boolean);

  if (propertyType === "Flat / Apartment") {
    if (parts.length !== 3) return false;
    const unitIdentifier = parts[0].match(/^(?:flat|apartment|unit)\s+(.+)$/i)?.[1]?.trim() ?? "";
    if (!unitIdentifier || /^(?:flat|apartment|unit)$/i.test(unitIdentifier)) return false;
    return Boolean(parts[1] && parts[2]);
  }

  return parts.length === 2 && Boolean(parts[0] && parts[1]);
}

/** Hash the code with its verification ID and auth secret (or configured fallback). */
function hashCode(id: string, code: string) {
  // Use exactly the nonempty auth secret required by Production readiness.
  const secret = resolveAuthSecret() ?? "proffera-booking-verification";
  return createHash("sha256").update(`${id}:${code}:${secret}`).digest("hex");
}

/** Normalize a database timestamp to UTC ISO text or reject an invalid value. */
function toIsoTimestamp(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error("Invalid booking verification timestamp");
  return date.toISOString();
}

/** Keep a customer portal token valid at least 30 days, capped at 400 days. */
function portalTokenLifetimeSeconds(bookingEndsAt: string) {
  const bookingEndMs = new Date(bookingEndsAt).getTime();
  const minimumMs = Date.now() + 30 * DAY_SECONDS * 1000;
  const desiredMs = Number.isFinite(bookingEndMs) ? bookingEndMs + 30 * DAY_SECONDS * 1000 : minimumMs;
  const cappedMs = Math.min(Math.max(minimumMs, desiredMs), Date.now() + 400 * DAY_SECONDS * 1000);
  return Math.max(30 * DAY_SECONDS, Math.ceil((cappedMs - Date.now()) / 1000));
}

/** Include address and postcode once while preserving other booking details. */
function buildBookingNote(address: string, postcode: string, bookingDetails: string) {
  const detailLines = bookingDetails.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const hasAddress = detailLines.some((line) => /^address\s*:/i.test(line));
  const hasPostcode = detailLines.some((line) => /^postcode\s*:/i.test(line));
  return [
    address && !hasAddress ? `Address: ${address}` : "",
    postcode && !hasPostcode ? `Postcode: ${postcode}` : "",
    ...detailLines,
  ].filter(Boolean).join("\n");
}

export type BeginBookingVerificationInput = {
  workspaceId: string;
  slug: string;
  companyName: string;
  ownerEmail?: string;
  ownerPhone?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  serviceId: string;
  serviceName: string;
  staffId?: string;
  city?: string;
  address?: string;
  postcode?: string;
  bookingDetails?: string;
  startsAt: string;
  endsAt: string;
  timeZone: WorkspaceTimeZone;
  language?: "sv" | "en" | "ar";
  verificationSms?: boolean;
};

/**
 * Create and deliver a short-lived booking challenge, not a confirmed booking.
 * Maria starts are held transactionally under the workspace-wide booking lock;
 * delivery and recipient safeguards are enforced for the active environment.
 */
export async function beginBookingEmailVerification(input: BeginBookingVerificationInput) {
  if (input.slug === "primeview" && !validatePrimeViewServiceAddress(input)) {
    return { ok: false as const, error: "address" };
  }

  // Enforce Maria's lifecycle and recipient authorization for EVERY caller,
  // not just the branded booking API. No generic /boka/[slug] request may
  // create a real customer hold while Maria Production is unready.
  if (input.slug === "makeup-by-maria") {
    const readiness = await getMariaBookingReadiness();
    if (!readiness.enabled || readiness.workspaceId !== input.workspaceId
      || readiness.publicSlug !== input.slug || !getMariaBookingPortalBase()
      || !isMariaBookingRecipientAllowed(input.customerEmail)
      || input.staffId || input.verificationSms) {
      return { ok: false as const, error: "invalid" };
    }
  }

  const sql = getSql();
  if (!sql) return { ok: false as const, error: "database" };
  if (!/^[0-9a-f-]{36}$/i.test(input.serviceId)) return { ok: false as const, error: "service" };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60_000).toISOString();

  const serviceRows = await sql`
    select s.id, s.name, w.slug as workspace_slug
    from workspace_services s
    join workspaces w on w.id::text=s.workspace_id
    where s.id = ${input.serviceId}::uuid
      and s.workspace_id = ${input.workspaceId}
      and s.is_active = true
    limit 1
  `;
  if (!serviceRows[0]) return { ok: false as const, error: "service" };
  // Check the actual workspace identity, not a mutable public booking alias.
  if (serviceRows[0].workspace_slug === "makeup-by-maria"
    && input.slug !== "makeup-by-maria") return { ok: false as const, error: "invalid" };

  // Maria is a single-person operation. Serialize all new holds for this
  // workspace, regardless of customer email, and check overlap INSIDE
  // the same transaction as the insert. A prior public UI check is not enough.
  const rows = input.slug === "makeup-by-maria"
    ? (await sql.transaction([
        sql`select pg_advisory_xact_lock(hashtextextended(${input.workspaceId}::text, 713))`,
        sql`
          insert into public_booking_verifications (
            workspace_id, public_booking_slug, customer_name, customer_email, customer_phone,
            service_id, service_name, staff_id, city, address, postcode, booking_details,
            starts_at, ends_at, code_hash, expires_at
          )
          select ${input.workspaceId}::uuid, ${input.slug}, ${input.customerName},
            ${input.customerEmail.toLowerCase()}, ${input.customerPhone || null},
            ${input.serviceId}::uuid, ${input.serviceName}, ${input.staffId || null}::uuid,
            ${input.city || null}, ${input.address || null}, ${input.postcode || null},
            ${input.bookingDetails || null}, ${input.startsAt}::timestamptz,
            ${input.endsAt}::timestamptz, '', ${expiresAt}::timestamptz
          where exists (
            select 1 from workspaces w
            join workspace_services s on s.workspace_id=w.id::text
            join workspace_booking_hours h on h.workspace_id=w.id::text
              and h.weekday=extract(dow from ${input.startsAt}::timestamptz at time zone 'Europe/Stockholm')::int
            where w.id=${input.workspaceId}::uuid and w.slug='makeup-by-maria'
              and w.public_booking_slug='makeup-by-maria' and w.status in ('active','trial')
              and s.id=${input.serviceId}::uuid and s.is_active=true and s.public_status='published'
              and s.duration_minutes between 1 and 1440
              and ${input.startsAt}::timestamptz >= now()
                + (s.minimum_notice_minutes * interval '1 minute')
              and ${input.startsAt}::timestamptz <= now()
                + (s.maximum_advance_days * interval '1 day')
              and ${input.staffId || null}::uuid is null
              and h.is_closed=false
              and (${input.startsAt}::timestamptz at time zone 'Europe/Stockholm')::time
                  between h.opens_at and h.closes_at
              and ${input.endsAt}::timestamptz = ${input.startsAt}::timestamptz
                  + (s.duration_minutes * interval '1 minute')
          )
          and not exists (
            select 1 from bookings b
            left join workspace_services bs on bs.id=b.service_id
              and bs.workspace_id=b.workspace_id
            where b.workspace_id=${input.workspaceId}
              and b.status not in ('cancelled','no_show')
              and b.starts_at - (coalesce(bs.buffer_before_minutes,0) * interval '1 minute')
                  < ${input.endsAt}::timestamptz
                    + (select coalesce(buffer_after_minutes,0) * interval '1 minute'
                       from workspace_services where id=${input.serviceId}::uuid)
              and b.ends_at + (coalesce(bs.buffer_after_minutes,0) * interval '1 minute')
                  > ${input.startsAt}::timestamptz
                    - (select coalesce(buffer_before_minutes,0) * interval '1 minute'
                       from workspace_services where id=${input.serviceId}::uuid)
          )
          and not exists (
            select 1 from maria_manual_closed_starts closed
            where closed.workspace_id=${input.workspaceId}::uuid
              and closed.starts_at=${input.startsAt}::timestamptz
          )
          and not exists (
            select 1 from public_booking_verifications v
            left join workspace_services vs on vs.id=v.service_id and vs.workspace_id=v.workspace_id::text
            where v.workspace_id=${input.workspaceId}::uuid
              and v.consumed_at is null and v.expires_at>now()
              and v.starts_at - (coalesce(vs.buffer_before_minutes,0) * interval '1 minute')
                  < ${input.endsAt}::timestamptz
                    + (select coalesce(buffer_after_minutes,0) * interval '1 minute'
                       from workspace_services where id=${input.serviceId}::uuid)
              and v.ends_at + (coalesce(vs.buffer_after_minutes,0) * interval '1 minute')
                  > ${input.startsAt}::timestamptz
                    - (select coalesce(buffer_before_minutes,0) * interval '1 minute'
                       from workspace_services where id=${input.serviceId}::uuid)
          )
          returning id
        `,
      ]))[1]
    : await sql`
      insert into public_booking_verifications (
        workspace_id, public_booking_slug, customer_name, customer_email, customer_phone,
        service_id, service_name, staff_id, city, address, postcode, booking_details,
        starts_at, ends_at, code_hash, expires_at
      ) values (
        ${input.workspaceId}::uuid, ${input.slug}, ${input.customerName},
        ${input.customerEmail.toLowerCase()}, ${input.customerPhone || null},
        ${input.serviceId}::uuid, ${input.serviceName}, ${input.staffId || null}::uuid,
        ${input.city || null}, ${input.address || null}, ${input.postcode || null},
        ${input.bookingDetails || null}, ${input.startsAt}::timestamptz,
        ${input.endsAt}::timestamptz, '', ${expiresAt}::timestamptz
      ) returning id
    `;
  const id = String(rows[0]?.id ?? "");
  if (!id) return { ok: false as const, error: input.slug === "makeup-by-maria" ? "conflict" : "database" };
  await sql`update public_booking_verifications set code_hash = ${hashCode(id, code)} where id = ${id}::uuid`;

  const effectiveInitialLanguage = input.language === "ar"
    && input.slug !== "makeup-by-maria"
    ? "en" : input.language;
  const [emailSent, smsSent] = await Promise.all([
    sendBookingVerificationEmail({ customerName: input.customerName, customerEmail: input.customerEmail, companyName: input.companyName, code, expiresMinutes: EXPIRY_MINUTES, language: effectiveInitialLanguage, branding: input.slug === "makeup-by-maria" ? "makeup-by-maria" : undefined }),
    input.verificationSms && input.customerPhone
      ? sendBookingVerificationSms({ customerPhone: input.customerPhone, companyName: input.companyName, code, expiresMinutes: EXPIRY_MINUTES, language: input.language === "ar" ? "en" : input.language })
      : Promise.resolve({ ok: false as const, skipped: true as const, message: "SMS verification not requested." }),
  ]);
  if (!emailSent.ok && !smsSent.ok) {
    // Brevo may have accepted a message despite a timeout / 5xx response.
    // Preserve the hold until expiry so a delivered OTP is still verifiable.
    if (!emailSent.ok && emailSent.deliveryOutcome === "uncertain") {
      return { ok: false as const, error: "email", verificationId: id, delivery: "uncertain" as const };
    }
    await sql`delete from public_booking_verifications where id = ${id}::uuid`;
    return { ok: false as const, error: "email" };
  }
  const delivery = emailSent.ok && smsSent.ok ? "email_sms" : smsSent.ok ? "sms" : "email";
  return { ok: true as const, verificationId: id, delivery };
}

/**
 * Resend an unconsumed challenge with cooldown and expiry checks. Maria holds
 * must be renewed against current booking availability before another code is sent.
 */
export async function resendPublicBookingCode(id: string, language: "sv" | "en" | "ar" = "sv") {
  const sql = getSql();
  if (!sql || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false as const, error: "invalid" };

  const rows = await sql`
    select v.*, w.slug as workspace_slug, coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name
    from public_booking_verifications v
    join workspaces w on w.id = v.workspace_id
    left join workspace_settings ws on ws.workspace_id = w.id::text
    where v.id = ${id}::uuid
    limit 1
  `;
  const challenge = rows[0];
  if (!challenge || challenge.consumed_at || challenge.verified_at) return { ok: false as const, error: "invalid" };
  if (challenge.workspace_slug === "makeup-by-maria"
    && challenge.public_booking_slug !== "makeup-by-maria") return { ok: false as const, error: "invalid" };

  const createdAt = new Date(String(challenge.created_at)).getTime();
  const updatedAt = new Date(String(challenge.updated_at ?? challenge.created_at)).getTime();
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > 60 * 60 * 1000) return { ok: false as const, error: "expired" };
  if (Number.isFinite(updatedAt) && Date.now() - updatedAt < 30_000) return { ok: false as const, error: "wait" };

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const companyName = String(challenge.company_name);
  const customerName = String(challenge.customer_name);
  const customerEmail = String(challenge.customer_email);
  const customerPhone = challenge.customer_phone ? String(challenge.customer_phone) : "";
  const useSms = String(challenge.public_booking_slug) === "primeview" && Boolean(customerPhone);
  if (String(challenge.public_booking_slug) === "makeup-by-maria") {
    const readiness = await getMariaBookingReadiness();
    if (!readiness.enabled || readiness.workspaceId !== String(challenge.workspace_id)
      || !isMariaBookingRecipientAllowed(customerEmail)) {
      return { ok: false as const, error: "invalid" };
    }

    const expectedHash = hashCode(id, code);
    const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60_000).toISOString();
    // Re-acquire the hold only after checking current bookings, other active
    // holds, service policy and buffers under Maria's workspace-wide lock.
    // An expired hold must not evict a booking created in the meantime.
    const renewed = await renewMariaPreviewHoldForResend({
      workspaceId: readiness.workspaceId,
      verificationId: id,
      expectedCodeHash: expectedHash,
      expiresAt,
    });
    if (!renewed.ok) return { ok: false as const, error: renewed.error };

    const delivered = await sendBookingVerificationEmail({
      customerName, customerEmail, companyName, code,
      expiresMinutes: EXPIRY_MINUTES, language, branding: "makeup-by-maria",
    });
    if (!delivered.ok) {
      // A timeout or provider 5xx may happen after the code was sent.
      // Preserve its verification hold unless the provider definitely rejected it.
      if (delivered.deliveryOutcome === "not_sent") {
        await sql`
          delete from public_booking_verifications
          where id = ${id}::uuid and workspace_id = ${readiness.workspaceId}::uuid
            and code_hash = ${expectedHash}
            and consumed_at is null and verified_at is null
        `;
      }
      return { ok: false as const, error: "email" };
    }
    return { ok: true as const, delivery: "email" as const };
  }


  const genericLanguage = language === "ar" ? "en" : language;
  const [emailSent, smsSent] = await Promise.all([
    sendBookingVerificationEmail({ customerName, customerEmail, companyName, code, expiresMinutes: EXPIRY_MINUTES, language: genericLanguage }),
    useSms
      ? sendBookingVerificationSms({ customerPhone, companyName, code, expiresMinutes: EXPIRY_MINUTES, language: language === "ar" ? "en" : language })
      : Promise.resolve({ ok: false as const, skipped: true as const, message: "SMS verification not requested." }),
  ]);
  if (!emailSent.ok && !smsSent.ok) return { ok: false as const, error: "email" };

  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60_000).toISOString();
  await sql`
    update public_booking_verifications
    set code_hash = ${hashCode(id, code)}, expires_at = ${expiresAt}::timestamptz, attempts = 0, updated_at = now()
    where id = ${id}::uuid and consumed_at is null and verified_at is null
  `;
  const delivery = emailSent.ok && smsSent.ok ? "email_sms" : smsSent.ok ? "sms" : "email";
  return { ok: true as const, delivery };
}

/**
 * Validate a six-digit challenge and finalize its booking. Wrong codes count
 * against attempt limits; Maria booking creation rechecks the current schedule
 * atomically rather than trusting the earlier availability preview.
 */
export async function verifyPublicBookingCode(id: string, code: string, language?: "sv" | "en" | "ar") {
  const sql = getSql();
  if (!sql || !/^[0-9a-f-]{36}$/i.test(id) || !/^\d{6}$/.test(code)) return { ok: false as const, error: "invalid" };

  const rows = await sql`
    select v.*, w.slug as workspace_slug, coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
      nullif(ws.contact_email, '') as owner_email, nullif(ws.contact_phone, '') as owner_phone,
      coalesce(nullif(ws.time_zone, ''), 'Europe/Stockholm') as time_zone
    from public_booking_verifications v
    join workspaces w on w.id = v.workspace_id
    left join workspace_settings ws on ws.workspace_id = w.id::text
    where v.id = ${id}::uuid
    limit 1
  `;
  const challenge = rows[0];
  if (!challenge) return { ok: false as const, error: "invalid" };
  // Permit a short authenticated recovery of the *existing* booking after
  // a lost verification response. Neither inserts nor sends email again.
  if (challenge.consumed_at || challenge.verified_at) {
    if (challenge.workspace_slug !== "makeup-by-maria"
      || challenge.public_booking_slug !== "makeup-by-maria"
      || !challenge.consumed_at || !challenge.verified_at
      || Number(challenge.attempts) >= Number(challenge.max_attempts)) {
      return { ok: false as const, error: "invalid" };
    }
    const consumedAtMs = Date.parse(String(challenge.consumed_at));
    if (!Number.isFinite(consumedAtMs) || consumedAtMs > Date.now()
      || Date.now() - consumedAtMs > 30 * 60 * 1000) {
      return { ok: false as const, error: "invalid" };
    }
    // Reserve a recovery attempt in PostgreSQL BEFORE testing the guess.
    // Under concurrent requests, only a caller that wins the conditional
    // row update may evaluate the code and issue a signed portal token.
    const reserved = await sql`
      update public_booking_verifications
      set attempts=attempts+1, updated_at=now()
      where id=${id}::uuid and consumed_at is not null
        and verified_at is not null
        and consumed_at<=now()
        and consumed_at>=now()-interval '30 minutes'
        and attempts<max_attempts
        and code_hash=${String(challenge.code_hash)}
      returning code_hash
    `;
    if (reserved.length !== 1) return { ok: false as const, error: "invalid" };
    if (hashCode(id, code) !== String(reserved[0]?.code_hash)) {
      return { ok: false as const, error: "code" };
    }
    const portalBase = getMariaBookingPortalBase();
    if (!portalBase || !isMariaBookingRecipientAllowed(String(challenge.customer_email))) {
      return { ok: false as const, error: "unavailable" };
    }
    const recovered = await sql`
      select b.id as booking_id,b.customer_id,b.ends_at
      from customer_events e
      join bookings b on b.id=e.booking_id and b.workspace_id=e.workspace_id
        and b.customer_id=e.customer_id
      where e.workspace_id=${String(challenge.workspace_id)}
        and e.event_type='booking' and e.metadata->>'source'='public_booking'
        and e.metadata->>'verification_id'=${id}
        and b.source='public_booking'
      order by e.created_at desc limit 1
    `;
    const linked = recovered[0];
    if (!linked?.booking_id || !linked?.customer_id) return { ok: false as const, error: "invalid" };
    const recoveryLanguage: "sv" | "en" | "ar" = language === "en" || language === "ar" ? language : "sv";
    const token = createCustomerCalendarToken({
      workspaceId: String(challenge.workspace_id), customerId: String(linked.customer_id),
      expiresInSeconds: portalTokenLifetimeSeconds(toIsoTimestamp(linked.ends_at)),
    });
    return { ok: true as const, slug: "makeup-by-maria",
      portalUrl: `${portalBase}/mina-bokningar/${encodeURIComponent(token)}?lang=${recoveryLanguage}` };
  }
  if (challenge.workspace_slug === "makeup-by-maria"
    && challenge.public_booking_slug !== "makeup-by-maria") return { ok: false as const, error: "invalid" };
  // Revalidate both the Maria workspace and current recipient policy when
  // verifying (not just when issuing). Preview revocation and Production flags
  // must prevent any previously issued challenge from being consumed.
  if (String(challenge.public_booking_slug) === "makeup-by-maria") {
    const readiness = await getMariaBookingReadiness();
    if (!readiness.enabled || readiness.workspaceId !== String(challenge.workspace_id)
      || !isMariaBookingRecipientAllowed(String(challenge.customer_email))) {
      return { ok: false as const, error: "invalid" };
    }
  }
  if (new Date(String(challenge.expires_at)) <= new Date()) return { ok: false as const, error: "expired" };
  if (Number(challenge.attempts) >= Number(challenge.max_attempts)) return { ok: false as const, error: "attempts" };

  if (hashCode(id, code) !== String(challenge.code_hash)) {
    await sql`
      update public_booking_verifications set attempts=attempts+1,updated_at=now()
      where id=${id}::uuid and consumed_at is null and verified_at is null
        and code_hash=${String(challenge.code_hash)}
        and attempts<max_attempts
    `;
    return { ok: false as const, error: "code" };
  }

  const serviceId = challenge.service_id ? String(challenge.service_id) : "";
  if (!serviceId) return { ok: false as const, error: "invalid" };
  const serviceRows = await sql`
    select id
    from workspace_services
    where id = ${serviceId}::uuid
      and workspace_id = ${String(challenge.workspace_id)}
      and is_active = true
    limit 1
  `;
  if (!serviceRows[0]) return { ok: false as const, error: "invalid" };

  const startsAt = toIsoTimestamp(challenge.starts_at);
  const endsAt = toIsoTimestamp(challenge.ends_at);
  const staffId = challenge.staff_id ? String(challenge.staff_id) : null;
  const address = challenge.address ? String(challenge.address) : "";
  const postcode = challenge.postcode ? String(challenge.postcode) : "";
  const bookingDetails = challenge.booking_details ? String(challenge.booking_details) : "";
  const bookingNote = buildBookingNote(address, postcode, bookingDetails);

  let bookingId: string;
  let customerId: string;

  if (String(challenge.public_booking_slug) === "makeup-by-maria") {
    // Refuse the write if the current environment has no trusted customer
    // portal origin (isolated Preview or canonical Production).
    if (!getMariaBookingPortalBase()) {
      return { ok: false as const, error: "unavailable" };
    }
    // Revalidates the code and the latest start window, service duration,
    // publication, buffer and all Maria bookings/holds under the same
    // workspace-scoped transaction lock used when a hold is created.
    const confirmed = await finalizeMariaVerifiedBooking({
      verificationId: id,
      expectedCodeHash: hashCode(id, code),
      bookingNote,
      bookingLanguage: language === "en" || language === "ar" ? language : "sv",
    });
    if (!confirmed.ok) return { ok: false as const, error: confirmed.error };
    bookingId = confirmed.bookingId;
    customerId = confirmed.customerId;
  } else {
    const conflict = await sql`
      select id from bookings
      where workspace_id = ${String(challenge.workspace_id)}
        and status not in ('cancelled', 'no_show')
        and (${staffId}::uuid is null or staff_id = ${staffId}::uuid or staff_id is null)
        and starts_at < ${endsAt}::timestamptz
        and ends_at > ${startsAt}::timestamptz
      limit 1
    `;
    if (conflict[0]) return { ok: false as const, error: "conflict" };

    const customerLockKey = `${String(challenge.workspace_id)}:${String(challenge.customer_email).toLowerCase()}`;
    const appendExistingCustomerNote = String(challenge.public_booking_slug) === "primeview" && Boolean(bookingNote);
    const [, booked] = await sql.transaction([
      sql`select pg_advisory_xact_lock(hashtextextended(${customerLockKey}::text, 0))`,
      sql`
        with existing_customer as (
          select id from customers
          where workspace_id = ${String(challenge.workspace_id)} and lower(email) = lower(${String(challenge.customer_email)})
          order by created_at asc nulls last, id asc limit 1
        ), inserted_customer as (
          insert into customers (workspace_id, name, email, phone, city, status, source, notes)
          select ${String(challenge.workspace_id)}, ${String(challenge.customer_name)}, ${String(challenge.customer_email)}, ${challenge.customer_phone ? String(challenge.customer_phone) : null}, ${challenge.city ? String(challenge.city) : null}, 'prospect', 'public_booking', ${bookingNote || null}
          where not exists (select 1 from existing_customer)
          returning id
        ), updated_existing_customer as (
          update customers
          set notes = case
            when coalesce(trim(notes), '') = '' then ${bookingNote || null}
            when position(${bookingNote} in coalesce(notes, '')) > 0 then notes
            else rtrim(notes) || E'\n\n' || ${bookingNote}
          end
          where ${appendExistingCustomerNote} = true
            and id in (select id from existing_customer)
          returning id
        ), selected_customer as (
          select id from existing_customer
          union all
          select id from inserted_customer
          union all
          select id from updated_existing_customer
          limit 1
        ), booking as (
          insert into bookings (workspace_id, customer_id, staff_id, service_id, title, service, city, status, starts_at, ends_at, source, notes)
          select ${String(challenge.workspace_id)}, id, ${staffId}::uuid, ${serviceId}::uuid, ${String(challenge.service_name)}, ${String(challenge.service_name)}, ${challenge.city ? String(challenge.city) : null}, 'requested', ${startsAt}::timestamptz, ${endsAt}::timestamptz, 'public_booking', ${bookingNote || null}
          from selected_customer limit 1 returning id, customer_id
        ), created_event as (
          insert into customer_events (workspace_id, customer_id, booking_id, event_type, title, description, metadata)
          select
            ${String(challenge.workspace_id)},
            booking.customer_id,
            booking.id,
            'booking',
            'Booking created',
            'Booking request created after customer email verification.',
            jsonb_build_object('source', 'public_booking', 'service', ${String(challenge.service_name)}::text)
          from booking
          returning id
        )
        update public_booking_verifications set verified_at = now(), consumed_at = now(), updated_at = now()
        where id = ${id}::uuid
        returning (select id from booking) as booking_id, (select customer_id from booking) as customer_id
      `,
    ]);
    const createdBookingId = String(booked?.[0]?.booking_id ?? "");
    const createdCustomerId = String(booked?.[0]?.customer_id ?? "");
    if (!createdBookingId || !createdCustomerId) return { ok: false as const, error: "save" };
    bookingId = createdBookingId;
    customerId = createdCustomerId;
  }

  const timeZone = String(challenge.time_zone) as WorkspaceTimeZone;
  const requestedConfirmationLanguage = language ?? (String(challenge.public_booking_slug) === "primeview" ? "en" : "sv");
  const isMaria = String(challenge.public_booking_slug) === "makeup-by-maria";
  // Arabic is supported for Maria in both deployments, never for other tenants.
  const confirmationLanguage: "sv" | "en" | "ar" = requestedConfirmationLanguage === "ar" && !isMaria
    ? "en" : requestedConfirmationLanguage;
  const portalToken = createCustomerCalendarToken({ workspaceId: String(challenge.workspace_id), customerId, expiresInSeconds: portalTokenLifetimeSeconds(endsAt) });
  // Never direct Preview-only Maria customers to Production portal links.
  const mariaPreview = isMaria && process.env.VERCEL_ENV === "preview";
  const appUrl = isMaria
    ? (getMariaBookingPortalBase() ?? "")
    : (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://www.proffera.se").replace(/\/$/, "");
  if (!appUrl) return { ok: false as const, error: "unavailable" };
  const encodedToken = encodeURIComponent(portalToken);
  const encodedBookingId = encodeURIComponent(bookingId);
  const portalPath = `/mina-bokningar/${encodedToken}`;
  const portalUrl = `${appUrl}${portalPath}?lang=${confirmationLanguage}`;
  const rescheduleUrl = `${appUrl}${portalPath}/${encodedBookingId}/boka-om?lang=${confirmationLanguage}`;

  const ownerEmailAllowed = challenge.owner_email
    && (!mariaPreview || isMariaPreviewTestRecipient(String(challenge.owner_email)));
  await Promise.allSettled([
    sendUnifiedBookingConfirmationEmail({ customerName: String(challenge.customer_name), customerEmail: String(challenge.customer_email), companyName: String(challenge.company_name), service: String(challenge.service_name), startsAt, endsAt, city: String(challenge.city ?? ""), address, postcode, timeZone, portalUrl, rescheduleUrl, language: confirmationLanguage, branding: isMaria ? "makeup-by-maria" : undefined }),
    ownerEmailAllowed ? sendBookingOwnerNotificationEmail({ ownerEmail: String(challenge.owner_email), companyName: String(challenge.company_name), customerName: String(challenge.customer_name), customerEmail: String(challenge.customer_email), customerPhone: String(challenge.customer_phone ?? ""), service: String(challenge.service_name), startsAt, endsAt, city: String(challenge.city ?? ""), address, postcode, timeZone, language: String(challenge.public_booking_slug) === "primeview" ? "en" : undefined }) : Promise.resolve(),
    !isMaria && challenge.owner_phone ? sendBookingOwnerSms({ ownerPhone: String(challenge.owner_phone), companyName: String(challenge.company_name), customerName: String(challenge.customer_name), customerPhone: String(challenge.customer_phone ?? ""), service: String(challenge.service_name), startsAt, timeZone }) : Promise.resolve(),
  ]);

  // The verified customer sees the authenticated booking immediately even
  // if the separate receipt email fails or public intake is later disabled.
  return { ok: true as const, slug: String(challenge.public_booking_slug),
    ...(isMaria ? { portalUrl } : {}) };
}