import "server-only";

import { createHash, randomInt } from "node:crypto";

import { sendBookingOwnerNotificationEmail } from "@/features/email/lead-email";
import { sendBookingVerificationEmail } from "@/features/email/booking-verification-email";
import { sendUnifiedBookingConfirmationEmail } from "@/features/email/unified-booking-confirmation-email";
import { sendBookingOwnerSms, sendBookingVerificationSms } from "@/features/sms/booking-sms";
import { createCustomerCalendarToken } from "@/lib/customer-calendar";
import { getSql } from "@/lib/db/server";
import type { WorkspaceTimeZone } from "@/lib/workspace-market";

const EXPIRY_MINUTES = 10;
const DAY_SECONDS = 60 * 60 * 24;

function hashCode(id: string, code: string) {
  const secret = process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET ?? "proffera-booking-verification";
  return createHash("sha256").update(`${id}:${code}:${secret}`).digest("hex");
}

function toIsoTimestamp(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error("Invalid booking verification timestamp");
  return date.toISOString();
}

function portalTokenLifetimeSeconds(bookingEndsAt: string) {
  const bookingEndMs = new Date(bookingEndsAt).getTime();
  const minimumMs = Date.now() + 30 * DAY_SECONDS * 1000;
  const desiredMs = Number.isFinite(bookingEndMs) ? bookingEndMs + 30 * DAY_SECONDS * 1000 : minimumMs;
  const cappedMs = Math.min(Math.max(minimumMs, desiredMs), Date.now() + 400 * DAY_SECONDS * 1000);
  return Math.max(30 * DAY_SECONDS, Math.ceil((cappedMs - Date.now()) / 1000));
}

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
  language?: "sv" | "en";
  verificationSms?: boolean;
};

export async function beginBookingEmailVerification(input: BeginBookingVerificationInput) {
  const sql = getSql();
  if (!sql) return { ok: false as const, error: "database" };
  if (!/^[0-9a-f-]{36}$/i.test(input.serviceId)) return { ok: false as const, error: "service" };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60_000).toISOString();

  const serviceRows = await sql`
    select id, name
    from workspace_services
    where id = ${input.serviceId}::uuid
      and workspace_id = ${input.workspaceId}
      and is_active = true
    limit 1
  `;
  if (!serviceRows[0]) return { ok: false as const, error: "service" };

  const rows = await sql`
    insert into public_booking_verifications (
      workspace_id, public_booking_slug, customer_name, customer_email, customer_phone,
      service_id, service_name, staff_id, city, address, postcode, booking_details,
      starts_at, ends_at, code_hash, expires_at
    ) values (
      ${input.workspaceId}::uuid, ${input.slug}, ${input.customerName}, ${input.customerEmail.toLowerCase()},
      ${input.customerPhone || null}, ${input.serviceId}::uuid, ${input.serviceName}, ${input.staffId || null}::uuid, ${input.city || null},
      ${input.address || null}, ${input.postcode || null}, ${input.bookingDetails || null},
      ${input.startsAt}::timestamptz, ${input.endsAt}::timestamptz, '', ${expiresAt}::timestamptz
    ) returning id
  `;
  const id = String(rows[0]?.id ?? "");
  if (!id) return { ok: false as const, error: "database" };
  await sql`update public_booking_verifications set code_hash = ${hashCode(id, code)} where id = ${id}::uuid`;

  const [emailSent, smsSent] = await Promise.all([
    sendBookingVerificationEmail({ customerName: input.customerName, customerEmail: input.customerEmail, companyName: input.companyName, code, expiresMinutes: EXPIRY_MINUTES, language: input.language }),
    input.verificationSms && input.customerPhone
      ? sendBookingVerificationSms({ customerPhone: input.customerPhone, companyName: input.companyName, code, expiresMinutes: EXPIRY_MINUTES, language: input.language })
      : Promise.resolve({ ok: false as const, skipped: true as const, message: "SMS verification not requested." }),
  ]);
  if (!emailSent.ok && !smsSent.ok) {
    await sql`delete from public_booking_verifications where id = ${id}::uuid`;
    return { ok: false as const, error: "email" };
  }
  const delivery = emailSent.ok && smsSent.ok ? "email_sms" : smsSent.ok ? "sms" : "email";
  return { ok: true as const, verificationId: id, delivery };
}

export async function resendPublicBookingCode(id: string, language: "sv" | "en" = "sv") {
  const sql = getSql();
  if (!sql || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false as const, error: "invalid" };

  const rows = await sql`
    select v.*, coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name
    from public_booking_verifications v
    join workspaces w on w.id = v.workspace_id
    left join workspace_settings ws on ws.workspace_id = w.id::text
    where v.id = ${id}::uuid
    limit 1
  `;
  const challenge = rows[0];
  if (!challenge || challenge.consumed_at || challenge.verified_at) return { ok: false as const, error: "invalid" };

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

  const [emailSent, smsSent] = await Promise.all([
    sendBookingVerificationEmail({ customerName, customerEmail, companyName, code, expiresMinutes: EXPIRY_MINUTES, language }),
    useSms
      ? sendBookingVerificationSms({ customerPhone, companyName, code, expiresMinutes: EXPIRY_MINUTES, language })
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

export async function verifyPublicBookingCode(id: string, code: string) {
  const sql = getSql();
  if (!sql || !/^[0-9a-f-]{36}$/i.test(id) || !/^\d{6}$/.test(code)) return { ok: false as const, error: "invalid" };

  const rows = await sql`
    select v.*, coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
      nullif(ws.contact_email, '') as owner_email, nullif(ws.contact_phone, '') as owner_phone,
      coalesce(nullif(ws.time_zone, ''), 'Europe/Stockholm') as time_zone
    from public_booking_verifications v
    join workspaces w on w.id = v.workspace_id
    left join workspace_settings ws on ws.workspace_id = w.id::text
    where v.id = ${id}::uuid
    limit 1
  `;
  const challenge = rows[0];
  if (!challenge || challenge.consumed_at || challenge.verified_at) return { ok: false as const, error: "invalid" };
  if (new Date(String(challenge.expires_at)) <= new Date()) return { ok: false as const, error: "expired" };
  if (Number(challenge.attempts) >= Number(challenge.max_attempts)) return { ok: false as const, error: "attempts" };

  if (hashCode(id, code) !== String(challenge.code_hash)) {
    await sql`update public_booking_verifications set attempts = attempts + 1, updated_at = now() where id = ${id}::uuid`;
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
      ), selected_customer as (
        select id from existing_customer union all select id from inserted_customer limit 1
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
  const bookingId = String(booked?.[0]?.booking_id ?? "");
  const customerId = String(booked?.[0]?.customer_id ?? "");
  if (!bookingId || !customerId) return { ok: false as const, error: "save" };

  const timeZone = String(challenge.time_zone) as WorkspaceTimeZone;
  const portalToken = createCustomerCalendarToken({ workspaceId: String(challenge.workspace_id), customerId, expiresInSeconds: portalTokenLifetimeSeconds(endsAt) });
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://www.proffera.se").replace(/\/$/, "");
  const encodedToken = encodeURIComponent(portalToken);
  const encodedBookingId = encodeURIComponent(bookingId);
  const portalUrl = `${appUrl}/mina-bokningar/${encodedToken}`;
  const rescheduleUrl = `${portalUrl}/${encodedBookingId}/boka-om`;

  await Promise.allSettled([
    sendUnifiedBookingConfirmationEmail({ customerName: String(challenge.customer_name), customerEmail: String(challenge.customer_email), companyName: String(challenge.company_name), service: String(challenge.service_name), startsAt, endsAt, city: String(challenge.city ?? ""), address, postcode, timeZone, portalUrl, rescheduleUrl, language: String(challenge.public_booking_slug) === "primeview" ? "en" : undefined }),
    challenge.owner_email ? sendBookingOwnerNotificationEmail({ ownerEmail: String(challenge.owner_email), companyName: String(challenge.company_name), customerName: String(challenge.customer_name), customerEmail: String(challenge.customer_email), customerPhone: String(challenge.customer_phone ?? ""), service: String(challenge.service_name), startsAt, endsAt, city: String(challenge.city ?? ""), address, postcode, timeZone, language: String(challenge.public_booking_slug) === "primeview" ? "en" : undefined }) : Promise.resolve(),
    challenge.owner_phone ? sendBookingOwnerSms({ ownerPhone: String(challenge.owner_phone), companyName: String(challenge.company_name), customerName: String(challenge.customer_name), customerPhone: String(challenge.customer_phone ?? ""), service: String(challenge.service_name), startsAt, timeZone }) : Promise.resolve(),
  ]);

  return { ok: true as const, slug: String(challenge.public_booking_slug) };
}
