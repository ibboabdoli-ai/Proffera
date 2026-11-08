import "server-only";

import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";

import { sendBookingChangeEmails } from "@/features/email/booking-change-email";
import { withMariaBookingNotificationLock } from "@/lib/maria-booking-notification-lock";
import { resolveCustomerPortalSecret } from "@/lib/auth-secret";
import { resolveDatabaseUrl } from "@/lib/db/database-url";
import { getMariaExistingBookingPortalBase, isMariaExistingBookingRecipientAllowed } from "@/lib/maria-preview-customer-safety";
import { resolveBookingTimeZone } from "@/lib/public-booking-policy";
import { postgresTimestampIso } from "@/lib/postgres-timestamp";
import type { WorkspaceTimeZone } from "@/lib/workspace-market";

const connectionString = resolveDatabaseUrl();
const portalSecret = resolveCustomerPortalSecret();
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

type TokenPayload = { workspaceId: string; customerId: string; exp: number };

export type CustomerCalendarBooking = {
  id: string;
  title: string;
  service: string;
  city: string;
  status: string;
  startsAt: string;
  endsAt: string;
};

export type CustomerCalendarData = {
  timeZone: WorkspaceTimeZone;
  customer: { id: string; name: string };
  upcoming: CustomerCalendarBooking[];
  history: CustomerCalendarBooking[];
  policy: {
    customerRescheduleEnabled: boolean;
    customerCancelEnabled: boolean;
    cancelNoticeHours: number;
  };
};

const encode = (value: string) => Buffer.from(value, "utf8").toString("base64url");

function sign(value: string) {
  if (!portalSecret) throw new Error("Missing customer portal secret");
  return crypto.createHmac("sha256", portalSecret).update(value).digest("base64url");
}

export function createCustomerCalendarToken(input: {
  workspaceId: string;
  customerId: string;
  expiresInSeconds?: number;
}) {
  const payload: TokenPayload = {
    workspaceId: input.workspaceId,
    customerId: input.customerId,
    exp: Math.floor(Date.now() / 1000) + (input.expiresInSeconds ?? TOKEN_TTL_SECONDS),
  };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifyCustomerCalendarToken(token: string): TokenPayload | null {
  try {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature || !portalSecret) return null;
    const actual = Buffer.from(signature);
    const expected = Buffer.from(sign(encoded));
    if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TokenPayload;
    return payload.workspaceId && payload.customerId && Number.isFinite(payload.exp) && payload.exp > Math.floor(Date.now() / 1000)
      ? payload
      : null;
  } catch {
    return null;
  }
}

const toBooking = (row: Record<string, unknown>): CustomerCalendarBooking => ({
  id: String(row.id ?? ""),
  title: String(row.title ?? row.service ?? "Bokning"),
  service: String(row.service ?? "Ej angiven"),
  city: String(row.city ?? ""),
  status: String(row.status ?? "requested"),
  startsAt: postgresTimestampIso(row.starts_at),
  endsAt: postgresTimestampIso(row.ends_at),
});

export async function getCustomerCalendar(token: string): Promise<CustomerCalendarData | null> {
  const payload = verifyCustomerCalendarToken(token);
  if (!payload || !connectionString) return null;
  const sql = neon(connectionString);

  const [customers, settings, policies] = await Promise.all([
    sql`select id, name from customers where id = ${payload.customerId} and workspace_id = ${payload.workspaceId} limit 1`,
    sql`select time_zone from workspace_settings where workspace_id = ${payload.workspaceId} limit 1`,
    sql`select customer_reschedule_enabled, customer_cancel_enabled, cancel_notice_hours from workspace_booking_reminder_settings where workspace_id = ${payload.workspaceId} limit 1`,
  ]);

  const customer = customers[0];
  if (!customer) return null;

  const bookings = await sql`
    select id, title, service, city, status, starts_at, ends_at
    from bookings
    where customer_id = ${payload.customerId}
      and workspace_id = ${payload.workspaceId}
      and source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
    order by starts_at asc
    limit 200
  `;

  const now = Date.now();
  const all = bookings.map(toBooking);
  const policy = policies[0];

  return {
    timeZone: resolveBookingTimeZone(settings[0]?.time_zone),
    customer: { id: String(customer.id), name: String(customer.name ?? "Kund") },
    upcoming: all.filter((booking) => new Date(booking.endsAt).getTime() >= now && booking.status !== "cancelled"),
    history: all.filter((booking) => new Date(booking.endsAt).getTime() < now || booking.status === "cancelled").reverse(),
    policy: {
      customerRescheduleEnabled: policy ? Boolean(policy.customer_reschedule_enabled) : true,
      customerCancelEnabled: policy ? Boolean(policy.customer_cancel_enabled) : true,
      cancelNoticeHours: policy ? Number(policy.cancel_notice_hours) : 0,
    },
  };
}

export async function getCustomerCalendarBooking(token: string, bookingId: string) {
  const payload = verifyCustomerCalendarToken(token);
  if (!payload || !connectionString || !bookingId) return null;
  const sql = neon(connectionString);
  const rows = await sql`
    select id, title, service, city, status, starts_at, ends_at
    from bookings
    where id = ${bookingId}
      and customer_id = ${payload.customerId}
      and workspace_id = ${payload.workspaceId}
      and source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
    limit 1
  `;
  return rows[0] ? toBooking(rows[0]) : null;
}

export async function cancelCustomerCalendarBooking(
  token: string,
  bookingId: string,
  language: "sv" | "en" | "ar",
) {
  const payload = verifyCustomerCalendarToken(token);
  if (!payload || !connectionString || !/^[0-9a-f-]{36}$/i.test(bookingId)) {
    return { ok: false as const, error: "invalid" };
  }

  const sql = neon(connectionString);
  const workspace = await sql`
    select slug from workspaces where id::text=${payload.workspaceId} limit 1
  `;
  const isMaria = String(workspace[0]?.slug ?? "") === "makeup-by-maria";
  const mariaBase = isMaria ? getMariaExistingBookingPortalBase() : null;
  if (isMaria) {
    // Existing, token-authenticated cancellations remain available when
    // new-booking intake is paused. Lifecycle site, manager, origin and
    // recipient authorization must still pass independently.
    if (!mariaBase) {
      return { ok: false as const, error: "not_allowed" };
    }
    const recipient = await sql`
      select email from customers where id=${payload.customerId}::uuid
        and workspace_id=${payload.workspaceId} limit 1
    `;
    if (!recipient[0] || !isMariaExistingBookingRecipientAllowed(String(recipient[0].email))) {
      return { ok: false as const, error: "not_allowed" };
    }
  }
  const cancellation = sql`
    with cancelled_booking as (
      update bookings b
      set status = 'cancelled',
          updated_at = now()
      from customers c,
           workspaces w
           left join workspace_settings ws on ws.workspace_id = w.id::text
           left join workspace_booking_reminder_settings ps on ps.workspace_id = w.id::text
      where b.id = ${bookingId}
        and b.customer_id = ${payload.customerId}
        and b.workspace_id = ${payload.workspaceId}
        and c.id = b.customer_id
        and c.workspace_id = b.workspace_id
        and w.id::text = b.workspace_id
        and coalesce(ps.customer_cancel_enabled, true) = true
        and (${!isMaria || process.env.VERCEL_ENV !== "preview"}::boolean or lower(btrim(c.email, chr(9) || chr(10) || chr(13) || ' '))=lower(${process.env.PROFFERA_MARIA_PREVIEW_TEST_EMAIL?.trim() ?? ""}))
        and b.status in ('requested', 'confirmed')
        and b.starts_at > now() + (coalesce(ps.cancel_notice_hours, 0) || ' hours')::interval
        and b.source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
      returning
        b.id,
        date_trunc('milliseconds',b.updated_at) as cancellation_revision,
        b.workspace_id,
        b.customer_id,
        b.service,
        b.city,
        b.starts_at,
        b.ends_at,
        c.name as customer_name,
        c.email as customer_email,
        coalesce(nullif(ws.company_name, ''), w.company_name, w.name) as company_name,
        nullif(ws.contact_email, '') as owner_email,
        coalesce(nullif(ws.time_zone, ''), 'Europe/Stockholm') as time_zone
    ),
    job_candidate as (
      select
        job.id,
        job.workspace_id,
        job.status as old_status
      from workspace_service_jobs job
      join cancelled_booking booking on booking.id = job.booking_id
      where job.workspace_id = ${payload.workspaceId}::uuid
        and job.status not in ('completed', 'cancelled')
    ),
    cancelled_job as (
      update workspace_service_jobs job
      set status = 'cancelled',
          cancelled_at = now(),
          updated_at = now()
      from job_candidate candidate
      where job.id = candidate.id
        and job.workspace_id = candidate.workspace_id
      returning job.id, job.workspace_id, candidate.old_status
    ),
    job_event as (
      insert into workspace_service_job_events (
        workspace_id,
        service_job_id,
        event_type,
        from_status,
        to_status,
        summary,
        metadata
      )
      select
        workspace_id,
        id,
        'status_changed',
        old_status,
        'cancelled',
        'Service job cancelled because the customer cancelled its booking.',
        jsonb_build_object('source', 'customer_portal_cancellation', 'booking_id', ${bookingId}::text)
      from cancelled_job
      returning id
    ),
    customer_event as (
      insert into customer_events (
        workspace_id,
        customer_id,
        booking_id,
        event_type,
        title,
        description,
        metadata
      )
      select
        workspace_id,
        customer_id,
        id,
        'status_change',
        'Bokning avbokad av kund',
        case when ${isMaria}::boolean
          then 'Kunden avbokade bokningen via Mina bokningar. E-postavisering väntar på bekräftelse; följ upp manuellt vid behov.'
          else 'Kunden avbokade bokningen via Mina bokningar.' end,
        jsonb_build_object('source', 'customer_portal', 'new_status', 'cancelled')
          || case when ${isMaria}::boolean
             then jsonb_build_object('notice_customer','pending','notice_owner',
               case when nullif(owner_email,'') is null then 'skipped' else 'pending' end)
             else '{}'::jsonb end
      from cancelled_booking
      returning id
    )
    select
      id,
      service,
      city,
      starts_at,
      ends_at,
      customer_name,
      customer_email,
      company_name,
      owner_email,
      time_zone,
      cancellation_revision,
      (select id::text from customer_event limit 1) as cancellation_notice_event_id
    from cancelled_booking
  `;
  const rows = isMaria
    ? (await sql.transaction([
        sql`select pg_advisory_xact_lock(hashtextextended(${payload.workspaceId}::text, 713))`,
        cancellation,
      ]))[1]
    : await cancellation;

  const booking = rows[0];
  if (!booking) return { ok: false as const, error: "not_allowed" };

  const base = mariaBase ?? (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://www.proffera.se").replace(/\/$/, "");
  const ownerEmail = booking.owner_email && (!isMaria
    || isMariaExistingBookingRecipientAllowed(String(booking.owner_email)))
    ? String(booking.owner_email) : undefined;
  // The booking and its pending notice were committed together. A provider
  // outage must not make an already-successful cancellation appear rolled back.
  const sendCancellation = () => sendBookingChangeEmails({
    kind: "cancelled",
    branding: isMaria ? "makeup-by-maria" : undefined,
    customerName: String(booking.customer_name),
    customerEmail: String(booking.customer_email),
    ownerEmail,
    companyName: String(booking.company_name),
    service: String(booking.service ?? "Bokning"),
    city: String(booking.city ?? ""),
    oldStartsAt: postgresTimestampIso(booking.starts_at),
    oldEndsAt: postgresTimestampIso(booking.ends_at),
    portalUrl: `${base}/mina-bokningar/${encodeURIComponent(token)}?lang=${language}`,
    timeZone: resolveBookingTimeZone(booking.time_zone),
    language,
  });
  let cancellationSuperseded = false;
  let deliveries: Awaited<ReturnType<typeof sendBookingChangeEmails>> = [];
  try {
    deliveries = isMaria ? await withMariaBookingNotificationLock(payload.workspaceId, async () => {
      const latest = await sql`
        select 1 from bookings b
        join customers c on c.id=b.customer_id and c.workspace_id=b.workspace_id
        where b.workspace_id=${payload.workspaceId} and b.id=${bookingId}::uuid
          and b.status='cancelled'
          -- PostgreSQL can retain microseconds in a stored timestamp;
          -- a JavaScript Date round-trip retains only milliseconds.
          -- Compare to the same precision rather than suppressing a current
          -- cancellation notice as falsely superseded.
          and date_trunc('milliseconds',b.starts_at)=date_trunc('milliseconds',${postgresTimestampIso(booking.starts_at)}::timestamptz)
          and date_trunc('milliseconds',b.ends_at)=date_trunc('milliseconds',${postgresTimestampIso(booking.ends_at)}::timestamptz)
          and date_trunc('milliseconds',b.updated_at)=date_trunc('milliseconds',${postgresTimestampIso(booking.cancellation_revision)}::timestamptz)
          and lower(btrim(c.email, chr(9) || chr(10) || chr(13) || ' '))=lower(${String(booking.customer_email).trim()})
        limit 1
      `;
      if (!latest[0]) {
        cancellationSuperseded = true;
        return [];
      }
      return sendCancellation();
    }) : await sendCancellation();
  } catch (error) {
    console.error("Cancellation notice serialization failed after booking commit", error);
  }

  if (isMaria && booking.cancellation_notice_event_id) {
    // 'accepted' means the provider accepted the request, NOT inbox delivery.
    const accepted = (index: number) => deliveries[index]?.status === "fulfilled"
      && (deliveries[index].value as { ok?: boolean })?.ok === true;
    const customerState = cancellationSuperseded ? "superseded" : accepted(0) ? "accepted" : "failed";
    const ownerState = !ownerEmail ? "skipped" : cancellationSuperseded ? "superseded" : accepted(1) ? "accepted" : "failed";
    const needsFollowup = customerState === "failed" || ownerState === "failed";
    const summary = needsFollowup
      ? "Kunden avbokade bokningen via Mina bokningar. E-post kunde inte bekräftas; kontakta kunden eller Maria manuellt."
      : "Kunden avbokade bokningen via Mina bokningar.";
    try {
      await sql`
        update customer_events
        set description=${summary},
            metadata=jsonb_set(jsonb_set(metadata,
              '{notice_customer}',to_jsonb(${customerState}::text)),
              '{notice_owner}',to_jsonb(${ownerState}::text))
              || jsonb_build_object('notice_checked_at',now()::text)
        where id=${String(booking.cancellation_notice_event_id)}::uuid
          and workspace_id=${payload.workspaceId}
          and booking_id=${bookingId}::uuid
          and metadata->>'source'='customer_portal'
          and metadata->>'new_status'='cancelled'
      `;
    } catch (error) {
      // Leave the durable 'pending' follow-up message; do not undo cancellation.
      console.error("Cancellation notice outcome could not be persisted", error);
    }
  }

  return { ok: true as const };
}