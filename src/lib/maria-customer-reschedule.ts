import "server-only";

import { sendBookingChangeEmails } from "@/features/email/booking-change-email";
import { getSql } from "@/lib/db/server";
import { getMariaAvailability } from "@/lib/maria-booking-availability";
import { getMariaPreviewBookingReadiness } from "@/lib/maria-preview-booking";
import { getMariaPreviewPortalBase, isMariaPreviewTestRecipient } from "@/lib/maria-preview-customer-safety";
import { parseLocalDateTime, validatePublicBookingPolicy } from "@/lib/public-booking-policy";

type MariaChangeInput = {
  workspaceId: string;
  customerId: string;
  bookingId: string;
  startsAtLocal: string;
  token: string;
  language: "sv" | "en" | "ar";
};

/**
 * Maria-only customer rescheduling. Like Maria hold/verification, revalidate
 * every predicate and conflict after acquiring the workspace advisory lock.
 * Generic customer booking behaviour for all other tenants stays unchanged.
 */
export async function rescheduleMariaCustomerBooking(input: MariaChangeInput) {
  const denied = { ok: false as const, error: "not_allowed" as const };
  const readiness = await getMariaPreviewBookingReadiness();
  const base = getMariaPreviewPortalBase();
  if (!readiness.enabled || readiness.workspaceId !== input.workspaceId || !base) return denied;
  const local = parseLocalDateTime(input.startsAtLocal);
  if (!local || local.minutes % 30 !== 0) return { ok: false as const, error: "time" as const };

  const sql = getSql();
  if (!sql) return denied;
  const before = await sql`
    select b.service_id, s.public_slug, s.duration_minutes, s.buffer_before_minutes,
      s.buffer_after_minutes, s.minimum_notice_minutes, s.maximum_advance_days,
      c.email as customer_email
    from bookings b
    join customers c on c.id=b.customer_id and c.workspace_id=b.workspace_id
    join workspace_services s on s.id=b.service_id and s.workspace_id=b.workspace_id
    where b.id=${input.bookingId}::uuid and b.workspace_id=${input.workspaceId}
      and b.customer_id=${input.customerId}::uuid and b.staff_id is null
      and b.status in ('requested','confirmed') and b.starts_at>now()
      and b.source='public_booking'
    limit 1
  `;
  const service = before[0];
  if (!service || !isMariaPreviewTestRecipient(String(service.customer_email))) return denied;

  const slug = String(service.public_slug ?? "");
  const match = /^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$/.exec(slug);
  const year = Number(match?.[2]);
  if (!match || local.year !== year) return { ok: false as const, error: "time" as const };
  const date = input.startsAtLocal.slice(0, 10);
  const time = input.startsAtLocal.slice(11, 16);
  const policy = validatePublicBookingPolicy({
    startsAt: input.startsAtLocal,
    now: new Date(),
    service: {
      durationMinutes: Number(service.duration_minutes),
      bufferBeforeMinutes: Number(service.buffer_before_minutes) || 0,
      bufferAfterMinutes: Number(service.buffer_after_minutes) || 0,
      minimumNoticeMinutes: Number(service.minimum_notice_minutes) || 0,
      maximumAdvanceDays: Number(service.maximum_advance_days) || 730,
    },
    // The DB transaction checks Maria's final *start* time separately.
    bookingHour: { opensAt: "00:00", closesAt: "23:59", isClosed: false },
    timeZone: "Europe/Stockholm",
  });
  if (policy.error || !policy.start || !policy.end) {
    return { ok: false as const, error: policy.error ?? "time" };
  }
  const advertised = await getMariaAvailability({
    workspaceId: input.workspaceId,
    date, year,
    kind: match[1] === "trial" ? "trial" : "without",
    timeZone: "Europe/Stockholm",
    excludeBookingId: input.bookingId,
  });
  if (!advertised.ok || !advertised.slots.includes(time)) {
    return { ok: false as const, error: "conflict" as const };
  }

  const start = policy.start.toISOString();
  const end = policy.end.toISOString();
  try {
    const [, changed] = await sql.transaction([
      sql`select pg_advisory_xact_lock(hashtextextended(${input.workspaceId}::text, 713))`,
      sql`
        with eligible as (
          select b.id, b.workspace_id, b.customer_id, b.starts_at as old_starts_at,
            b.ends_at as old_ends_at, c.name as customer_name, c.email as customer_email,
            coalesce(nullif(ws.company_name,''),w.company_name,w.name) as company_name,
            nullif(ws.contact_email,'') as owner_email,
            coalesce(nullif(ws.time_zone,''),'Europe/Stockholm') as time_zone,
            s.name as service_name, b.city,
            coalesce(ps.company_confirmation_required,true) as needs_confirmation
          from bookings b
          join workspaces w on w.id::text=b.workspace_id
          join customers c on c.id=b.customer_id and c.workspace_id=b.workspace_id
          join workspace_services s on s.id=b.service_id and s.workspace_id=b.workspace_id
          join workspace_booking_hours h on h.workspace_id=b.workspace_id
            and h.weekday=extract(dow from ${start}::timestamptz at time zone 'Europe/Stockholm')::int
          left join workspace_settings ws on ws.workspace_id=b.workspace_id
          left join workspace_booking_reminder_settings ps on ps.workspace_id=b.workspace_id
          where b.id=${input.bookingId}::uuid
            and b.customer_id=${input.customerId}::uuid
            and b.workspace_id=${input.workspaceId}
            and b.staff_id is null and b.source='public_booking'
            and b.status in ('requested','confirmed') and b.starts_at>now()
            and w.slug='makeup-by-maria' and w.public_booking_slug='makeup-by-maria'
            and w.status in ('active','trial')
            and lower(c.email)=lower(${process.env.PROFFERA_MARIA_PREVIEW_TEST_EMAIL?.trim() ?? ""})
            and coalesce(ps.customer_reschedule_enabled,true)=true
            and s.public_slug=${slug} and s.is_active=true and s.public_status='published'
            and s.duration_minutes between 1 and 1440
            and ${end}::timestamptz=${start}::timestamptz+(s.duration_minutes*interval '1 minute')
            and ${start}::timestamptz>=now()+(s.minimum_notice_minutes*interval '1 minute')
            and ${start}::timestamptz<=now()+(s.maximum_advance_days*interval '1 day')
            and extract(dow from ${start}::timestamptz at time zone 'Europe/Stockholm')::int in (5,6)
            and h.is_closed=false
            and ( ${start}::timestamptz at time zone 'Europe/Stockholm')::time
                between h.opens_at and h.closes_at
            and extract(minute from (${start}::timestamptz at time zone 'Europe/Stockholm'))::int in (0,30)
            and not exists (
              select 1 from bookings other
              left join workspace_services os on os.id=other.service_id
                and os.workspace_id=other.workspace_id
              where other.workspace_id=b.workspace_id and other.id<>b.id
                and other.status not in ('cancelled','no_show')
                and other.starts_at-(coalesce(os.buffer_before_minutes,0)*interval '1 minute')
                    < ${end}::timestamptz+(s.buffer_after_minutes*interval '1 minute')
                and other.ends_at+(coalesce(os.buffer_after_minutes,0)*interval '1 minute')
                    > ${start}::timestamptz-(s.buffer_before_minutes*interval '1 minute')
            )
            and not exists (
              select 1 from public_booking_verifications hold
              left join workspace_services hs on hs.id=hold.service_id
                and hs.workspace_id=hold.workspace_id::text
              where hold.workspace_id=w.id and hold.consumed_at is null
                and hold.expires_at>now()
                and hold.starts_at-(coalesce(hs.buffer_before_minutes,0)*interval '1 minute')
                    < ${end}::timestamptz+(s.buffer_after_minutes*interval '1 minute')
                and hold.ends_at+(coalesce(hs.buffer_after_minutes,0)*interval '1 minute')
                    > ${start}::timestamptz-(s.buffer_before_minutes*interval '1 minute')
            )
          limit 1
        ),
        changed_booking as (
          update bookings b
          set starts_at=${start}::timestamptz,ends_at=${end}::timestamptz,
            status=case when eligible.needs_confirmation then 'requested' else 'confirmed' end,
            updated_at=now()
          from eligible
          where b.id=eligible.id and b.starts_at=eligible.old_starts_at
            and b.status in ('requested','confirmed')
          returning b.id,b.workspace_id,b.customer_id,b.status,
            eligible.old_starts_at,eligible.old_ends_at,eligible.customer_name,
            eligible.customer_email,eligible.company_name,eligible.owner_email,
            eligible.time_zone,eligible.service_name,eligible.city
        ),
        changed_job as (
          update workspace_service_jobs j
          set scheduled_starts_at=${start}::timestamptz,
            scheduled_ends_at=${end}::timestamptz,updated_at=now()
          from changed_booking b
          where j.booking_id=b.id and j.workspace_id=${input.workspaceId}::uuid
            and j.status not in ('completed','cancelled')
          returning j.id,j.workspace_id
        ),
        job_event as (
          insert into workspace_service_job_events(
            workspace_id,service_job_id,event_type,summary,metadata)
          select workspace_id,id,'status_changed',
            'Maria preview customer changed a booking time.',
            jsonb_build_object('source','maria_preview_reschedule','booking_id',${input.bookingId}::text)
          from changed_job returning id
        ),
        customer_event as (
          insert into customer_events(workspace_id,customer_id,booking_id,event_type,
            title,description,metadata)
          select workspace_id,customer_id,id,'booking',
            'Bokning ombokad av kund','Customer changed Maria preview booking time.',
            jsonb_build_object('source','maria_preview_reschedule',
              'starts_at',${start}::text,'ends_at',${end}::text)
          from changed_booking returning id
        )
        select * from changed_booking
      `,
    ]);
    const booking = changed?.[0];
    if (!booking) return { ok: false as const, error: "conflict" as const };
    // Do not deliver Preview notifications to any recipient beyond the QA inbox.
    await sendBookingChangeEmails({
      kind: "rescheduled",
      customerName: String(booking.customer_name),
      customerEmail: String(booking.customer_email),
      ownerEmail: booking.owner_email && isMariaPreviewTestRecipient(String(booking.owner_email))
        ? String(booking.owner_email) : undefined,
      companyName: String(booking.company_name),
      service: String(booking.service_name),
      city: String(booking.city ?? ""),
      oldStartsAt: new Date(String(booking.old_starts_at)).toISOString(),
      oldEndsAt: new Date(String(booking.old_ends_at)).toISOString(),
      newStartsAt: start,
      newEndsAt: end,
      portalUrl: `${base}/mina-bokningar/${encodeURIComponent(input.token)}?lang=${input.language}`,
      timeZone: "Europe/Stockholm",
      language: input.language,
    });
    return { ok: true as const };
  } catch (error) {
    console.error("Maria preview reschedule failed closed", error);
    return { ok: false as const, error: "conflict" as const };
  }
}
