import "server-only";

import { neon } from "@neondatabase/serverless";

import { resolveDatabaseUrl } from "@/lib/db/database-url";
import { isMariaPreviewTestRecipient } from "@/lib/maria-preview-customer-safety";

import { resolveBookingTimeZone } from "@/lib/public-booking-policy";
import { deliverVerifiedReviewInvitation } from "@/lib/verified-review-email-delivery";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  resolveDatabaseUrl();

const allowedBookingStatuses = ["requested", "confirmed", "completed", "cancelled"] as const;

export type DashboardBookingStatus = (typeof allowedBookingStatuses)[number];

export type DashboardBookingStatusUpdateResult = {
  changed: boolean;
  timeZone: ReturnType<typeof resolveBookingTimeZone>;
  notification: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    service: string;
    city: string;
    startsAt: string;
    endsAt: string;
    language: "sv" | "en" | "ar";
  } | null;
  reviewInvitationDelivery: "sent" | "failed" | "skipped" | null;
};

function getSqlClient() {
  if (!connectionString) {
    return null;
  }

  return neon(connectionString);
}

async function getActiveWorkspaceAccess() {
  const access = await getUserWorkspaceAccess();

  if (!access.ok || !canManageWorkspaceSettings(access)) {
    throw new Error("An owner or admin workspace membership is required for booking updates");
  }

  return access;
}

export function isDashboardBookingStatus(value: string): value is DashboardBookingStatus {
  return allowedBookingStatuses.includes(value as DashboardBookingStatus);
}

export async function updateDashboardBookingStatus(
  bookingId: string,
  status: DashboardBookingStatus,
): Promise<DashboardBookingStatusUpdateResult> {
  const sql = getSqlClient();

  if (!sql) {
    throw new Error("Missing database connection for dashboard booking status update");
  }

  const access = await getActiveWorkspaceAccess();
  const workspaceId = access.workspaceId;
  const mariaPreview = access.workspaceSlug === "makeup-by-maria";
  const mariaRecipient = process.env.PROFFERA_MARIA_PREVIEW_TEST_EMAIL?.trim().toLowerCase() ?? "";
  // Maria's manager may only mutate isolated QA bookings in Preview.
  if (mariaPreview && !isMariaPreviewTestRecipient(mariaRecipient)) {
    throw new Error("Maria status changes require the approved Preview recipient");
  }
  const marketRows = await sql`
    select time_zone
    from workspace_settings
    where workspace_id = ${workspaceId}
    limit 1
  `;
  const timeZone = resolveBookingTimeZone(marketRows[0]?.time_zone);

  const updateQuery = sql`
    with existing_booking as (
      select
        b.id,
        b.workspace_id,
        b.customer_id,
        b.status as old_status,
        b.service,
        b.city,
        b.title,
        b.notes,
        b.starts_at,
        b.ends_at,
        b.staff_id,
        c.name as customer_name,
        c.email as customer_email,
        c.phone as customer_phone,
        case when ${mariaPreview}::boolean then coalesce((
          select e.metadata->>'language' from customer_events e
          where e.workspace_id=b.workspace_id and e.booking_id=b.id
            and e.event_type='booking' and e.metadata->>'source'='public_booking'
            and e.metadata->>'language' in ('sv','en','ar')
          order by e.created_at desc,e.id desc limit 1
        ),'sv') else 'sv' end as booking_language
      from bookings b
      left join customers c
        on c.id = b.customer_id
       and c.workspace_id = b.workspace_id
      where b.workspace_id = ${workspaceId}
        and b.id = ${bookingId}
        and (${!mariaPreview}::boolean or lower(trim(c.email))=${mariaRecipient})
    ),
    updated_booking as (
      update bookings
      set
        status = ${status},
        updated_at = now()
      where workspace_id = ${workspaceId}
        and id = ${bookingId}
        and status <> ${status}
        and (${!mariaPreview}::boolean or exists (
          select 1 from customers c
          where c.id=bookings.customer_id and c.workspace_id=bookings.workspace_id
            and lower(trim(c.email))=${mariaRecipient}
        ))
        -- Reopening a cancelled Maria reservation is an activation, not a
        -- harmless status label edit. Under lock 713, reject other live
        -- appointments and unexpired verification holds, including buffers.
        -- Unrelated workspaces retain their existing status semantics.
        and (
          ${!mariaPreview}::boolean or ${status}::text not in ('requested', 'confirmed')
          or (
            not exists (
              select 1 from bookings other
              left join workspace_services other_service
                on other_service.id=other.service_id and other_service.workspace_id=other.workspace_id
              left join workspace_services current_service
                on current_service.id=bookings.service_id and current_service.workspace_id=bookings.workspace_id
              where other.workspace_id=bookings.workspace_id and other.id<>bookings.id
                and other.status not in ('cancelled','no_show')
                and other.starts_at-(coalesce(other_service.buffer_before_minutes,0)*interval '1 minute')
                    < bookings.ends_at+(coalesce(current_service.buffer_after_minutes,0)*interval '1 minute')
                and other.ends_at+(coalesce(other_service.buffer_after_minutes,0)*interval '1 minute')
                    > bookings.starts_at-(coalesce(current_service.buffer_before_minutes,0)*interval '1 minute')
            )
            and not exists (
              select 1 from public_booking_verifications hold
              left join workspace_services hold_service
                on hold_service.id=hold.service_id and hold_service.workspace_id=hold.workspace_id::text
              left join workspace_services current_service
                on current_service.id=bookings.service_id and current_service.workspace_id=bookings.workspace_id
              where hold.workspace_id=bookings.workspace_id::uuid
                and hold.consumed_at is null and hold.expires_at>clock_timestamp()
                and hold.starts_at-(coalesce(hold_service.buffer_before_minutes,0)*interval '1 minute')
                    < bookings.ends_at+(coalesce(current_service.buffer_after_minutes,0)*interval '1 minute')
                and hold.ends_at+(coalesce(hold_service.buffer_after_minutes,0)*interval '1 minute')
                    > bookings.starts_at-(coalesce(current_service.buffer_before_minutes,0)*interval '1 minute')
            )
          )
        )
      returning
        id,
        workspace_id,
        customer_id,
        status as new_status
    ),
    created_job as (
      insert into workspace_service_jobs (
        workspace_id,
        source_type,
        booking_id,
        customer_id,
        assigned_staff_id,
        status,
        title,
        description,
        service_name,
        city,
        scheduled_starts_at,
        scheduled_ends_at
      )
      select
        ${workspaceId}::uuid,
        'booking',
        updated_booking.id,
        updated_booking.customer_id,
        existing_booking.staff_id,
        case when existing_booking.staff_id is null then 'new' else 'assigned' end,
        existing_booking.title,
        coalesce(existing_booking.notes, ''),
        existing_booking.service,
        existing_booking.city,
        existing_booking.starts_at,
        existing_booking.ends_at
      from updated_booking
      join existing_booking on existing_booking.id = updated_booking.id
      where updated_booking.new_status = 'confirmed'
      on conflict (booking_id) where booking_id is not null do nothing
      returning id, workspace_id, booking_id, status
    ),
    created_job_event as (
      insert into workspace_service_job_events (
        workspace_id, service_job_id, event_type, to_status, summary, metadata
      )
      select
        workspace_id,
        id,
        'created',
        status,
        'Service job created from confirmed booking.',
        jsonb_build_object('source', 'confirmed_booking', 'booking_id', booking_id)
      from created_job
      returning id
    ),
    source_job_candidate as (
      select
        job.id,
        job.workspace_id,
        job.status as old_status,
        updated_booking.new_status as booking_status
      from workspace_service_jobs job
      join updated_booking on job.booking_id = updated_booking.id
      where job.workspace_id = ${workspaceId}::uuid
        and updated_booking.new_status in ('completed', 'cancelled')
        and job.status not in ('completed', 'cancelled')
    ),
    source_job_sync as (
      update workspace_service_jobs job
      set
        status = case when source_job_candidate.booking_status = 'completed' then 'completed' else 'cancelled' end,
        completion_summary = case when source_job_candidate.booking_status = 'completed' then 'Booking source marked completed.' else job.completion_summary end,
        completed_at = case when source_job_candidate.booking_status = 'completed' then now() else job.completed_at end,
        cancelled_at = case when source_job_candidate.booking_status = 'cancelled' then now() else job.cancelled_at end,
        updated_at = now()
      from source_job_candidate
      where job.id = source_job_candidate.id
        and job.workspace_id = source_job_candidate.workspace_id
      returning job.id, job.workspace_id, source_job_candidate.old_status, job.status as new_status, source_job_candidate.booking_status
    ),
    source_job_event as (
      insert into workspace_service_job_events (
        workspace_id, service_job_id, event_type, from_status, to_status, summary, metadata
      )
      select
        workspace_id,
        id,
        'status_changed',
        old_status,
        new_status,
        'Service job synchronized with its booking source.',
        jsonb_build_object('source', 'booking_status_change', 'booking_status', booking_status)
      from source_job_sync
      returning id
    ),
    source_completion_evidence as (
      insert into workspace_service_job_completion_evidence (
        workspace_id, service_job_id, evidence_type, description
      )
      select
        workspace_id,
        id,
        'note',
        'Booking source marked completed.'
      from source_job_sync
      where booking_status = 'completed'
      returning id, workspace_id, service_job_id
    ),
    source_evidence_event as (
      insert into workspace_service_job_events (
        workspace_id, service_job_id, event_type, summary, metadata
      )
      select
        workspace_id,
        service_job_id,
        'completion_evidence_added',
        'Completion evidence recorded from booking source.',
        jsonb_build_object('source', 'booking_status_change')
      from source_completion_evidence
      returning id
    ),
    inserted_event as (
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
        updated_booking.workspace_id,
        updated_booking.customer_id,
        updated_booking.id,
        'status_change',
        'Booking status updated',
        'Status changed from ' || existing_booking.old_status || ' to ' || updated_booking.new_status || '.',
        jsonb_build_object(
          'source', 'dashboard_manual',
          'old_status', existing_booking.old_status,
          'new_status', updated_booking.new_status,
          'service_job_id', (select id from created_job limit 1)
        )
      from updated_booking
      join existing_booking on existing_booking.id = updated_booking.id
      returning id
    )
    select
      (select id from existing_booking limit 1) as booking_id,
      (select count(*)::int from updated_booking) as updated_count,
      (select count(*)::int from inserted_event) as event_count,
      (select customer_name from existing_booking limit 1) as customer_name,
      (select customer_email from existing_booking limit 1) as customer_email,
      (select customer_phone from existing_booking limit 1) as customer_phone,
      (select service from existing_booking limit 1) as service,
      (select city from existing_booking limit 1) as city,
      (select starts_at from existing_booking limit 1) as starts_at,
      (select ends_at from existing_booking limit 1) as ends_at,
      (select booking_language from existing_booking limit 1) as booking_language
  `;

  // Lock the entire Maria status mutation (including job creation) against
  // Maria's locked reschedule/verification writers. Other tenants retain the
  // original single-query path without acquiring Maria's workspace lock.
  const rows = mariaPreview
    ? (await sql.transaction([
        sql`select pg_advisory_xact_lock(hashtextextended(${workspaceId}::text, 713))`,
        updateQuery,
      ]))[1]
    : await updateQuery;

  const result = rows[0];

  if (!result?.booking_id) {
    throw new Error("Booking status update did not match a booking");
  }

  const changed = Number(result.updated_count ?? 0) > 0;
  const notification = changed
    ? {
        customerName: String(result.customer_name ?? "Kund"),
        customerEmail: String(result.customer_email ?? ""),
        customerPhone: String(result.customer_phone ?? ""),
        service: String(result.service ?? "Bokning"),
        city: String(result.city ?? ""),
        startsAt: new Date(String(result.starts_at)).toISOString(),
        endsAt: new Date(String(result.ends_at)).toISOString(),
        language: result.booking_language === "ar" ? "ar" as const
          : result.booking_language === "en" ? "en" as const : "sv" as const,
      }
    : null;

  let reviewInvitationDelivery: DashboardBookingStatusUpdateResult["reviewInvitationDelivery"] = null;
  if (changed && status === "completed") {
    reviewInvitationDelivery = notification?.customerEmail ? "failed" : "skipped";

    if (notification?.customerEmail) {
      try {
        const delivery = await deliverVerifiedReviewInvitation(bookingId);
        reviewInvitationDelivery = delivery.ok
          ? "sent"
          : delivery.code === "email" || delivery.code === "missing_email"
            ? "failed"
            : "skipped";
      } catch (error) {
        console.error("Failed to deliver verified review invitation", error);
        reviewInvitationDelivery = "failed";
      }
    }
  }

  return {
    changed,
    timeZone,
    notification,
    reviewInvitationDelivery,
  };
}
