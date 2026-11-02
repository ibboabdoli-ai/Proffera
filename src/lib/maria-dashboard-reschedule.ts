import "server-only";

import { getSql } from "@/lib/db/server";
import type { BookingRescheduleResult } from "@/lib/dashboard-booking-reschedule";
import { getMariaAvailability } from "@/lib/maria-booking-availability";
import { getMariaPreviewPortalBase, isMariaPreviewTestRecipient } from "@/lib/maria-preview-customer-safety";
import { isValidLocalTime, localDateTimeToUtc, parseLocalDateTime } from "@/lib/public-booking-policy";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { hasDashboardModuleAccess } from "@/lib/workspace-module-access";

type MariaDashboardRescheduleResult =
  | { ok: true; result: BookingRescheduleResult }
  | { ok: false; error: "time" | "past" | "status" | "conflict" };

const validUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One Maria operator: lock + revalidate booking, service, day, active holds and
 * every other booking within one transaction before writing. The generic
 * multi-staff dashboard path deliberately remains unchanged.
 */
export async function rescheduleMariaDashboardBooking(input: {
  bookingId: string; workspaceId: string; localStartsAt: string;
}): Promise<MariaDashboardRescheduleResult> {
  const denied = { ok: false as const, error: "status" as const };
  const access = await getUserWorkspaceAccess();
  if (process.env.VERCEL_ENV !== "preview" || !getMariaPreviewPortalBase()
    || !access.ok || !canManageWorkspaceSettings(access)
    || access.workspaceSlug !== "makeup-by-maria" || access.workspaceId !== input.workspaceId
    || !validUuid.test(input.bookingId)
    || !(await hasDashboardModuleAccess("online_booking"))) return denied;
  const approvedRecipient = process.env.PROFFERA_MARIA_PREVIEW_TEST_EMAIL?.trim().toLowerCase();
  if (!approvedRecipient || !isMariaPreviewTestRecipient(approvedRecipient)) return denied;

  const local = parseLocalDateTime(input.localStartsAt);
  if (!local || local.minutes % 30 !== 0) return { ok: false, error: "time" };
  const timeZone = "Europe/Stockholm" as const;
  const start = localDateTimeToUtc(local, timeZone);
  if (!isValidLocalTime(local, start, timeZone) || !Number.isFinite(start.getTime())) {
    return { ok: false, error: "time" };
  }
  if (start.getTime() <= Date.now()) return { ok: false, error: "past" };
  const date = input.localStartsAt.slice(0, 10);
  const clock = input.localStartsAt.slice(11, 16);

  const sql = getSql();
  if (!sql) return { ok: false, error: "conflict" };
  const before = await sql`
    select b.id, b.starts_at::text as starts_at, b.ends_at::text as ends_at, b.status, b.source, b.staff_id,
      c.email as customer_email, s.public_slug, s.duration_minutes
    from bookings b
    join customers c on c.id=b.customer_id and c.workspace_id=b.workspace_id
    join workspace_services s on s.id=b.service_id and s.workspace_id=b.workspace_id
    where b.workspace_id=${input.workspaceId} and b.id=${input.bookingId}::uuid
      and b.status in ('requested','confirmed') and b.starts_at>now()
      and b.staff_id is null and b.source='public_booking'
    limit 1
  `;
  const booking = before[0];
  if (!booking || !isMariaPreviewTestRecipient(String(booking.customer_email))) return denied;
  const match = /^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$/.exec(String(booking.public_slug ?? ""));
  if (!match || Number(match[2]) !== local.year) return { ok: false, error: "time" };
  const oldStart = new Date(String(booking.starts_at));
  const oldEnd = new Date(String(booking.ends_at));
  const durationMs = oldEnd.getTime() - oldStart.getTime();
  if (durationMs < 60_000 || durationMs !== Number(booking.duration_minutes) * 60_000) {
    return { ok: false, error: "status" };
  }
  if (oldStart.getTime() === start.getTime()) {
    return { ok: true, result: { changed: false, timeZone, notification: null } };
  }

  const end = new Date(start.getTime() + durationMs);
  const offered = await getMariaAvailability({
    workspaceId: input.workspaceId, date, year: local.year,
    kind: match[1] === "trial" ? "trial" : "without",
    excludeBookingId: input.bookingId,
    timeZone,
  });
  if (!offered.ok || !offered.slots.includes(clock)) {
    return { ok: false, error: "conflict" };
  }

  const newStartIso = start.toISOString();
  const newEndIso = end.toISOString();
  // PostgreSQL can retain microseconds; a JS Date round-trip would lose them
  // and falsely reject an unchanged booking during the exact CAS check.
  const previousStart = String(booking.starts_at);
  const previousEnd = String(booking.ends_at);
  try {
    const [, result] = await sql.transaction([
      sql`select pg_advisory_xact_lock(hashtextextended(${input.workspaceId}::text, 713))`,
      sql`
        with eligible as (
          select b.id,b.workspace_id,b.customer_id,b.starts_at as previous_starts_at,
            b.ends_at as previous_ends_at,c.name as customer_name,c.email as customer_email,
            c.phone as customer_phone,b.service as service_name,b.city
          from bookings b
          join workspaces w on w.id::text=b.workspace_id
          join customers c on c.id=b.customer_id and c.workspace_id=b.workspace_id
          join workspace_services s on s.id=b.service_id and s.workspace_id=b.workspace_id
          join workspace_booking_hours h on h.workspace_id=b.workspace_id
            and h.weekday=extract(dow from ${newStartIso}::timestamptz at time zone 'Europe/Stockholm')::int
          where b.workspace_id=${input.workspaceId} and b.id=${input.bookingId}::uuid
            and b.starts_at=${previousStart}::timestamptz
            and b.ends_at=${previousEnd}::timestamptz
            and b.status in ('requested','confirmed') and b.starts_at>now()
            and b.staff_id is null and b.source='public_booking'
            and lower(trim(c.email))=${approvedRecipient}
            and w.slug='makeup-by-maria' and w.status in ('active','trial')
            and s.public_slug=${String(booking.public_slug)}
            and s.is_active=true and s.public_status='published'
            and s.duration_minutes between 1 and 1440
            and ${newEndIso}::timestamptz=${newStartIso}::timestamptz+(s.duration_minutes*interval '1 minute')
            and ${newStartIso}::timestamptz >= now()+(s.minimum_notice_minutes*interval '1 minute')
            and ${newStartIso}::timestamptz <= now()+(s.maximum_advance_days*interval '1 day')
            and extract(dow from ${newStartIso}::timestamptz at time zone 'Europe/Stockholm')::int in (0,5,6)
            and h.is_closed=false
            and (${newStartIso}::timestamptz at time zone 'Europe/Stockholm')::time between h.opens_at and h.closes_at
            and (${newStartIso}::timestamptz at time zone 'Europe/Stockholm')::date
              =(${newEndIso}::timestamptz at time zone 'Europe/Stockholm')::date
            and extract(minute from (${newStartIso}::timestamptz at time zone 'Europe/Stockholm'))::int in (0,30)
            and not exists (
              select 1 from bookings other
              left join workspace_services os on os.id=other.service_id
                and os.workspace_id=other.workspace_id
              where other.workspace_id=b.workspace_id and other.id<>b.id
                and other.status not in ('cancelled','no_show')
                and other.starts_at-(coalesce(os.buffer_before_minutes,0)*interval '1 minute')
                  < ${newEndIso}::timestamptz+(s.buffer_after_minutes*interval '1 minute')
                and other.ends_at+(coalesce(os.buffer_after_minutes,0)*interval '1 minute')
                  > ${newStartIso}::timestamptz-(s.buffer_before_minutes*interval '1 minute')
            )
            and not exists (
              select 1 from public_booking_verifications hold
              left join workspace_services hs on hs.id=hold.service_id
                and hs.workspace_id=hold.workspace_id::text
              where hold.workspace_id=w.id and hold.consumed_at is null and hold.expires_at>now()
                and hold.starts_at-(coalesce(hs.buffer_before_minutes,0)*interval '1 minute')
                  < ${newEndIso}::timestamptz+(s.buffer_after_minutes*interval '1 minute')
                and hold.ends_at+(coalesce(hs.buffer_after_minutes,0)*interval '1 minute')
                  > ${newStartIso}::timestamptz-(s.buffer_before_minutes*interval '1 minute')
            )
          limit 1
          for update of b
        ),
        moved as (
          update bookings b
          set starts_at=${newStartIso}::timestamptz,
            ends_at=${newEndIso}::timestamptz,updated_at=now()
          from eligible
          where b.id=eligible.id and b.starts_at=eligible.previous_starts_at
            and b.status in ('requested','confirmed')
          returning b.id,b.workspace_id,b.customer_id,eligible.customer_name,
            eligible.customer_email,eligible.customer_phone,eligible.service_name,
            eligible.city,eligible.previous_starts_at,eligible.previous_ends_at
        ),
        updated_job as (
          update workspace_service_jobs j
          set scheduled_starts_at=${newStartIso}::timestamptz,
            scheduled_ends_at=${newEndIso}::timestamptz,updated_at=now()
          from moved b
          where j.booking_id=b.id and j.workspace_id=${input.workspaceId}::uuid
            and j.status not in ('completed','cancelled')
          returning j.id,j.workspace_id
        ),
        job_event as (
          insert into public.workspace_service_job_events(workspace_id,service_job_id,event_type,summary,metadata)
          select workspace_id,id,'status_changed','Maria dashboard booking time rescheduled.',
            jsonb_build_object('source','maria_preview_dashboard_reschedule','booking_id',${input.bookingId}::text)
          from updated_job returning id
        ),
        customer_event as (
          insert into customer_events(workspace_id,customer_id,booking_id,event_type,title,description,metadata)
          select workspace_id,customer_id,id,'booking',
            'Bokning ombokad','Maria dashboard changed the booking time.',
            jsonb_build_object('source','maria_preview_dashboard_reschedule',
              'starts_at',${newStartIso}::text,'ends_at',${newEndIso}::text)
          from moved returning id
        )
        select * from moved
      `,
    ]);
    const updated = result?.[0];
    if (!updated) return { ok: false, error: "conflict" };
    return {
      ok: true,
      result: {
        changed: true,
        timeZone,
        notification: {
          customerName: String(updated.customer_name ?? "Kund"),
          customerEmail: String(updated.customer_email ?? ""),
          customerPhone: String(updated.customer_phone ?? ""),
          service: String(updated.service_name ?? "Bokning"),
          city: String(updated.city ?? ""),
          previousStartsAt: oldStart.toISOString(),
          startsAt: newStartIso,
          endsAt: newEndIso,
        },
      },
    };
  } catch (error) {
    console.error("Maria dashboard reschedule failed closed", error);
    return { ok: false, error: "conflict" };
  }
}
