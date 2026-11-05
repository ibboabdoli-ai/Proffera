import "server-only";

import { getSql } from "@/lib/db/server";

/**
 * Re-acquire an expired Maria Preview hold only if its slot is still free.
 *
 * Hold creation, confirmation and resend all serialize on the same
 * workspace advisory transaction lock. In particular, extending expires_at
 * without an in-transaction conflict check could hide a newer hold/booking.
 * This affects only Maria Preview; no other tenant's resend is changed.
 */
export async function renewMariaPreviewHoldForResend(input: {
  workspaceId: string;
  verificationId: string;
  expectedCodeHash: string;
  expiresAt: string;
}) {
  const sql = getSql();
  if (!sql) return { ok: false as const, error: "database" as const };

  try {
    const [, renewed] = await sql.transaction([
      sql`select pg_advisory_xact_lock(hashtextextended(${input.workspaceId}::text, 713))`,
      sql`
        update public_booking_verifications v
        set code_hash = ${input.expectedCodeHash},
          expires_at = ${input.expiresAt}::timestamptz,
          attempts = 0, updated_at = now()
        where v.id = ${input.verificationId}::uuid
          and v.workspace_id = ${input.workspaceId}::uuid
          and v.public_booking_slug = 'makeup-by-maria'
          and v.staff_id is null
          and v.consumed_at is null and v.verified_at is null
          and v.created_at >= now() - interval '1 hour'
          and v.updated_at <= now() - interval '30 seconds'
          and exists (
            select 1 from workspaces w
            join workspace_services s on s.id = v.service_id
              and s.workspace_id = w.id::text
            join workspace_booking_hours h on h.workspace_id = w.id::text
              and h.weekday = extract(dow from v.starts_at at time zone 'Europe/Stockholm')::int
            where w.id = v.workspace_id
              and w.slug = 'makeup-by-maria'
              and w.public_booking_slug = 'makeup-by-maria'
              and w.status in ('active','trial')
              and s.public_status = 'published' and s.is_active = true
              and s.public_slug ~ '^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$'
              and s.duration_minutes between 1 and 1440
              and v.ends_at = v.starts_at + (s.duration_minutes * interval '1 minute')
              and v.starts_at >= now() + (s.minimum_notice_minutes * interval '1 minute')
              and v.starts_at <= now() + (s.maximum_advance_days * interval '1 day')
              and h.is_closed = false
              and (v.starts_at at time zone 'Europe/Stockholm')::time
                  between h.opens_at and h.closes_at
              and not exists (
                select 1 from bookings b
                left join workspace_services bs on bs.id = b.service_id
                  and bs.workspace_id = b.workspace_id
                where b.workspace_id = w.id::text
                  and b.status not in ('cancelled','no_show')
                  and b.starts_at - (coalesce(bs.buffer_before_minutes,0) * interval '1 minute')
                      < v.ends_at + (coalesce(s.buffer_after_minutes,0) * interval '1 minute')
                  and b.ends_at + (coalesce(bs.buffer_after_minutes,0) * interval '1 minute')
                      > v.starts_at - (coalesce(s.buffer_before_minutes,0) * interval '1 minute')
              )
              and not exists (
                select 1 from public_booking_verifications other
                left join workspace_services os on os.id = other.service_id
                  and os.workspace_id = other.workspace_id::text
                where other.workspace_id = v.workspace_id
                  and other.id <> v.id
                  and other.consumed_at is null and other.expires_at > now()
                  and other.starts_at - (coalesce(os.buffer_before_minutes,0) * interval '1 minute')
                      < v.ends_at + (coalesce(s.buffer_after_minutes,0) * interval '1 minute')
                  and other.ends_at + (coalesce(os.buffer_after_minutes,0) * interval '1 minute')
                      > v.starts_at - (coalesce(s.buffer_before_minutes,0) * interval '1 minute')
              )
          )
        returning v.id
      `,
    ]);

    return renewed?.[0]
      ? { ok: true as const }
      : { ok: false as const, error: "conflict" as const };
  } catch (error) {
    console.error("Maria Preview hold resend revalidation failed", error);
    return { ok: false as const, error: "database" as const };
  }
}
