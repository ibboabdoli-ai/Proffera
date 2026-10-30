import "server-only";

import { getSql } from "@/lib/db/server";
import { availableMariaStartSlots, type MariaBusyInterval } from "@/lib/maria-booking-slots";
import { parseLocalDateTime } from "@/lib/public-booking-policy";

type AvailabilityRequest = {
  workspaceId: string;
  date: string;
  year: number;
  kind: "trial" | "without";
  timeZone: "Europe/Stockholm";
  // Only authenticated self-service can exclude its own existing booking.
  excludeBookingId?: string;
};

export type MariaAvailabilityResult =
  | { ok: true; slots: string[] }
  | { ok: false; error: "invalid" | "service" | "hours" | "database" };

export async function getMariaAvailability(input: AvailabilityRequest): Promise<MariaAvailabilityResult> {
  const parsed = parseLocalDateTime(`${input.date}T00:00`);
  if (!parsed || parsed.year !== input.year || input.year < 2026 || input.year > 2036) {
    return { ok: false, error: "invalid" };
  }
  const weekday = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay();
  if (weekday !== 5 && weekday !== 6) return { ok: false, error: "hours" };
  if (input.excludeBookingId && !/^[0-9a-f-]{36}$/i.test(input.excludeBookingId)) {
    return { ok: false, error: "invalid" };
  }
  const sql = getSql();
  if (!sql) return { ok: false, error: "database" };
  const slug = `maria-bridal-${input.kind === "trial" ? "trial" : "without-trial"}-${input.year}`;

  // Limit reads to the selected Maria service and one local-day horizon.
  // Every reservation occupies time across all packages, not just its service.
  const before = new Date(Date.parse(`${input.date}T00:00:00Z`) - 172_800_000).toISOString();
  const after = new Date(Date.parse(`${input.date}T00:00:00Z`) + 259_200_000).toISOString();

  try {
    const [services, hours, busy] = await Promise.all([
      sql`
        select duration_minutes, buffer_before_minutes, buffer_after_minutes,
          minimum_notice_minutes, maximum_advance_days
        from workspace_services
        where workspace_id = ${input.workspaceId}
          and public_slug = ${slug}
          and public_status = 'published'
          and is_active = true
          and duration_minutes between 1 and 1440
        limit 1
      `,
      sql`
        select opens_at::text as opens_at, closes_at::text as closes_at, is_closed
        from workspace_booking_hours
        where workspace_id = ${input.workspaceId} and weekday = ${weekday}
        limit 1
      `,
      sql`
        select b.starts_at::text as starts_at, b.ends_at::text as ends_at,
          coalesce(s.buffer_before_minutes,0) as buffer_before_minutes,
          coalesce(s.buffer_after_minutes,0) as buffer_after_minutes
        from bookings b
        left join workspace_services s
          on s.id = b.service_id and s.workspace_id = b.workspace_id
        where b.workspace_id = ${input.workspaceId}
          and b.status not in ('cancelled','no_show')
          and (${input.excludeBookingId ?? null}::uuid is null or b.id <> ${input.excludeBookingId ?? null}::uuid)
          and b.starts_at < ${after}::timestamptz
          and b.ends_at > ${before}::timestamptz
        union all
        select v.starts_at::text, v.ends_at::text,
          coalesce(s.buffer_before_minutes,0), coalesce(s.buffer_after_minutes,0)
        from public_booking_verifications v
        left join workspace_services s
          on s.id = v.service_id and s.workspace_id = v.workspace_id::text
        where v.workspace_id = ${input.workspaceId}::uuid
          and v.consumed_at is null and v.expires_at > now()
          and v.starts_at < ${after}::timestamptz
          and v.ends_at > ${before}::timestamptz
      `,
    ]);
    const service = services[0];
    if (!service) return { ok: false, error: "service" };
    const hoursRow = hours[0];
    if (!hoursRow || hoursRow.is_closed || !hoursRow.opens_at || !hoursRow.closes_at) {
      return { ok: false, error: "hours" };
    }

    const occupied: MariaBusyInterval[] = busy.map(row => ({
      startsAt: String(row.starts_at),
      endsAt: String(row.ends_at),
      bufferBeforeMinutes: Number(row.buffer_before_minutes) || 0,
      bufferAfterMinutes: Number(row.buffer_after_minutes) || 0,
    }));
    return {
      ok: true,
      slots: availableMariaStartSlots({
        date: input.date,
        earliestStart: String(hoursRow.opens_at).slice(0,5),
        latestStart: String(hoursRow.closes_at).slice(0,5),
        durationMinutes: Number(service.duration_minutes),
        bufferBeforeMinutes: Number(service.buffer_before_minutes) || 0,
        bufferAfterMinutes: Number(service.buffer_after_minutes) || 0,
        minimumNoticeMinutes: Number(service.minimum_notice_minutes) || 0,
        maximumAdvanceDays: Number(service.maximum_advance_days) || 730,
        busy: occupied,
        now: new Date(),
        timeZone: input.timeZone,
        stepMinutes: 30,
      }),
    };
  } catch (error) {
    console.error("Maria availability failed closed", error);
    return { ok: false, error: "database" };
  }
}
