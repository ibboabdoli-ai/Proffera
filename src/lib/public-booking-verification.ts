import "server-only";

import { createHash, randomInt } from "node:crypto";

import { getSql } from "@/lib/db/server";
import { sendBookingConfirmationEmail, sendBookingOwnerNotificationEmail } from "@/features/email/lead-email";
import { sendBookingOwnerSms } from "@/features/sms/booking-sms";
import { sendBookingVerificationEmail } from "@/features/email/booking-verification-email";
import type { WorkspaceTimeZone } from "@/lib/workspace-market";

const EXPIRY_MINUTES = 10;

function hashCode(id: string, code: string) {
  const secret = process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_SECRET ?? "proffera-booking-verification";
  return createHash("sha256").update(`${id}:${code}:${secret}`).digest("hex");
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
  serviceName: string;
  city?: string;
  startsAt: string;
  endsAt: string;
  timeZone: WorkspaceTimeZone;
};

export async function beginBookingEmailVerification(input: BeginBookingVerificationInput) {
  const sql = getSql();
  if (!sql) return { ok: false as const, error: "database" };
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + EXPIRY_MINUTES * 60_000).toISOString();

  const rows = await sql`
    insert into public_booking_verifications (
      workspace_id, public_booking_slug, customer_name, customer_email, customer_phone,
      service_name, city, starts_at, ends_at, code_hash, expires_at
    ) values (
      ${input.workspaceId}::uuid, ${input.slug}, ${input.customerName}, ${input.customerEmail.toLowerCase()},
      ${input.customerPhone || null}, ${input.serviceName}, ${input.city || null},
      ${input.startsAt}::timestamptz, ${input.endsAt}::timestamptz, '', ${expiresAt}::timestamptz
    ) returning id
  `;
  const id = String(rows[0]?.id ?? "");
  if (!id) return { ok: false as const, error: "database" };
  await sql`update public_booking_verifications set code_hash = ${hashCode(id, code)} where id = ${id}::uuid`;

  const sent = await sendBookingVerificationEmail({
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    companyName: input.companyName,
    code,
    expiresMinutes: EXPIRY_MINUTES,
  });
  if (!sent.ok) {
    await sql`delete from public_booking_verifications where id = ${id}::uuid`;
    return { ok: false as const, error: "email" };
  }
  return { ok: true as const, verificationId: id };
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

  const conflict = await sql`
    select id from bookings
    where workspace_id = ${String(challenge.workspace_id)}
      and status not in ('cancelled', 'no_show')
      and starts_at < ${String(challenge.ends_at)}::timestamptz
      and ends_at > ${String(challenge.starts_at)}::timestamptz
    limit 1
  `;
  if (conflict[0]) return { ok: false as const, error: "conflict" };

  const booked = await sql`
    with customer as (
      insert into customers (workspace_id, name, email, phone, city, status, source)
      values (${String(challenge.workspace_id)}, ${String(challenge.customer_name)}, ${String(challenge.customer_email)}, ${challenge.customer_phone ? String(challenge.customer_phone) : null}, ${challenge.city ? String(challenge.city) : null}, 'prospect', 'public_booking')
      on conflict do nothing
      returning id
    ), selected_customer as (
      select id from customer
      union all
      select id from customers where workspace_id = ${String(challenge.workspace_id)} and lower(email) = lower(${String(challenge.customer_email)}) order by id limit 1
    ), booking as (
      insert into bookings (workspace_id, customer_id, title, service, city, status, starts_at, ends_at, source)
      select ${String(challenge.workspace_id)}, id, ${String(challenge.service_name)}, ${String(challenge.service_name)}, ${challenge.city ? String(challenge.city) : null}, 'requested', ${String(challenge.starts_at)}::timestamptz, ${String(challenge.ends_at)}::timestamptz, 'public_booking'
      from selected_customer limit 1 returning id
    )
    update public_booking_verifications set verified_at = now(), consumed_at = now(), updated_at = now()
    where id = ${id}::uuid returning (select id from booking) as booking_id
  `;
  if (!booked[0]?.booking_id) return { ok: false as const, error: "save" };

  const timeZone = String(challenge.time_zone) as WorkspaceTimeZone;
  await Promise.allSettled([
    sendBookingConfirmationEmail({ customerName: String(challenge.customer_name), customerEmail: String(challenge.customer_email), companyName: String(challenge.company_name), bookingTitle: String(challenge.service_name), service: String(challenge.service_name), startsAt: String(challenge.starts_at), endsAt: String(challenge.ends_at), city: String(challenge.city ?? ""), timeZone }),
    challenge.owner_email ? sendBookingOwnerNotificationEmail({ ownerEmail: String(challenge.owner_email), companyName: String(challenge.company_name), customerName: String(challenge.customer_name), customerEmail: String(challenge.customer_email), customerPhone: String(challenge.customer_phone ?? ""), service: String(challenge.service_name), startsAt: String(challenge.starts_at), endsAt: String(challenge.ends_at), city: String(challenge.city ?? ""), timeZone }) : Promise.resolve(),
    challenge.owner_phone ? sendBookingOwnerSms({ ownerPhone: String(challenge.owner_phone), companyName: String(challenge.company_name), customerName: String(challenge.customer_name), customerPhone: String(challenge.customer_phone ?? ""), service: String(challenge.service_name), startsAt: String(challenge.starts_at), timeZone }) : Promise.resolve(),
  ]);

  return { ok: true as const, slug: String(challenge.public_booking_slug) };
}
