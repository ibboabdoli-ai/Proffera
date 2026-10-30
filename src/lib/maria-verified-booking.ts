import "server-only";

import { getSql } from "@/lib/db/server";
import { getMariaPreviewBookingReadiness } from "@/lib/maria-preview-booking";

type FinalizeMariaInput = {
  verificationId: string;
  expectedCodeHash: string;
  bookingNote: string;
};

/**
 * Proffera's Maria Preview bookings have no staff allocation: there is exactly
 * one operator across every Maria service. Every hold creation and every
 * verified booking must acquire the SAME transaction-scoped workspace lock.
 *
 * This query is intentionally one DB transaction: check code + latest service
 * settings + start-time window + bookings + active holds, insert customer and
 * booking, and consume the verification token together. No email-based lock.
 */
export async function finalizeMariaVerifiedBooking(input: FinalizeMariaInput) {
  const readiness = await getMariaPreviewBookingReadiness();
  if (!readiness.enabled) return { ok: false as const, error: "unavailable" };

  const sql = getSql();
  if (!sql) return { ok: false as const, error: "database" };

  try {
    const result = await sql.transaction([
      sql`select pg_advisory_xact_lock(hashtextextended(${readiness.workspaceId}::text, 713))`,
      sql`
        with eligible as (
          select v.*, s.name as current_service_name
          from public_booking_verifications v
          join workspaces w on w.id=v.workspace_id
          join workspace_services s on s.id=v.service_id and s.workspace_id=w.id::text
          join workspace_booking_hours h on h.workspace_id=w.id::text
            and h.weekday=extract(dow from v.starts_at at time zone 'Europe/Stockholm')::int
          where v.id=${input.verificationId}::uuid
            and v.workspace_id=${readiness.workspaceId}::uuid
            and v.public_booking_slug='makeup-by-maria'
            and v.staff_id is null
            and v.code_hash=${input.expectedCodeHash}
            and v.consumed_at is null and v.verified_at is null
            and v.expires_at>now() and v.attempts < v.max_attempts
            and w.slug='makeup-by-maria'
            and w.public_booking_slug='makeup-by-maria'
            and w.status in ('active','trial')
            and s.public_status='published' and s.is_active=true
            and s.public_slug ~ '^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$'
            and s.duration_minutes between 1 and 1440
            and v.ends_at = v.starts_at + (s.duration_minutes * interval '1 minute')
            and v.starts_at >= now() + (s.minimum_notice_minutes * interval '1 minute')
            and v.starts_at <= now() + (s.maximum_advance_days * interval '1 day')
            and h.is_closed=false
            and (v.starts_at at time zone 'Europe/Stockholm')::time between h.opens_at and h.closes_at
            and not exists (
              select 1 from bookings b
              left join workspace_services bs on bs.id=b.service_id and bs.workspace_id=b.workspace_id
              where b.workspace_id=w.id::text and b.status not in ('cancelled','no_show')
                and b.starts_at - (coalesce(bs.buffer_before_minutes,0)*interval '1 minute')
                  < v.ends_at + (s.buffer_after_minutes*interval '1 minute')
                and b.ends_at + (coalesce(bs.buffer_after_minutes,0)*interval '1 minute')
                  > v.starts_at - (s.buffer_before_minutes*interval '1 minute')
            )
            and not exists (
              select 1 from public_booking_verifications hold
              left join workspace_services hs
                on hs.id=hold.service_id and hs.workspace_id=hold.workspace_id::text
              where hold.workspace_id=v.workspace_id and hold.id<>v.id
                and hold.consumed_at is null and hold.expires_at>now()
                and hold.starts_at - (coalesce(hs.buffer_before_minutes,0)*interval '1 minute')
                  < v.ends_at + (s.buffer_after_minutes*interval '1 minute')
                and hold.ends_at + (coalesce(hs.buffer_after_minutes,0)*interval '1 minute')
                  > v.starts_at - (s.buffer_before_minutes*interval '1 minute')
            )
          limit 1
        ),
        existing_customer as (
          select c.id from customers c
          join eligible v on c.workspace_id=v.workspace_id::text
            and lower(c.email)=lower(v.customer_email)
          order by c.created_at asc nulls last, c.id asc limit 1
        ),
        created_customer as (
          insert into customers(workspace_id,name,email,phone,city,status,source,notes)
          select v.workspace_id::text,v.customer_name,v.customer_email,
            v.customer_phone,v.city,'prospect','public_booking',
            nullif(${input.bookingNote},'')
          from eligible v where not exists(select 1 from existing_customer)
          returning id
        ),
        customer as (
          select id from existing_customer
          union all select id from created_customer
        ),
        booking as (
          insert into bookings(workspace_id,customer_id,staff_id,service_id,title,service,
            city,status,starts_at,ends_at,source,notes)
          select v.workspace_id::text, c.id, null::uuid, v.service_id,
            v.current_service_name,v.current_service_name,v.city,
            'requested',v.starts_at,v.ends_at,'public_booking',
            nullif(${input.bookingNote},'')
          from eligible v cross join customer c
          returning id,customer_id
        ),
        event as (
          insert into customer_events(workspace_id,customer_id,booking_id,event_type,title,description,metadata)
          select ${readiness.workspaceId},b.customer_id,b.id,'booking',
            'Booking created','Maria appointment created after verified email.',
            jsonb_build_object('source','public_booking','service','Makeup by Maria')
          from booking b returning id
        ),
        consumed as (
          update public_booking_verifications v
          set verified_at=now(),consumed_at=now(),updated_at=now()
          where v.id=${input.verificationId}::uuid and v.consumed_at is null
            and exists(select 1 from booking)
          returning v.id
        )
        select b.id as booking_id,b.customer_id
        from booking b join consumed on true
      `,
    ]);
    const item = result[1]?.[0];
    if (!item?.booking_id || !item?.customer_id) {
      return { ok: false as const, error: "conflict" };
    }
    return {
      ok: true as const,
      bookingId: String(item.booking_id),
      customerId: String(item.customer_id),
    };
  } catch (error) {
    console.error("Maria atomic booking verification failed", error);
    return { ok: false as const, error: "save" };
  }
}
