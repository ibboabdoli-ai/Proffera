import "server-only";

import { neon } from "@neondatabase/serverless";

import { resolveDatabaseUrl } from "@/lib/db/database-url";

import { deliverVerifiedReviewInvitation } from "@/lib/verified-review-email-delivery";
import {
  canTransitionWorkspaceServiceJob,
  isWorkspaceServiceJobStatus,
  type WorkspaceServiceJobStatus,
} from "@/lib/workspace-service-job-policy";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  resolveDatabaseUrl();

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSqlClient() {
  return connectionString ? neon(connectionString) : null;
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function nullableText(value: unknown) {
  const result = text(value).trim();
  return result || null;
}

async function getActiveWorkspaceAccess(requireManager = false) {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || (requireManager && !canManageWorkspaceSettings(access))) {
    throw new Error(requireManager ? "An owner or admin workspace membership is required for service job changes" : "Workspace access is required for service jobs");
  }
  return access;
}

export type WorkspaceServiceJobSourceType = "quote_offer" | "booking";

export type DashboardWorkspaceServiceJob = {
  id: string;
  sourceType: WorkspaceServiceJobSourceType;
  quoteRequestId: string;
  quoteOfferId: string;
  bookingId: string;
  customerId: string;
  customerName: string;
  assignedStaffId: string;
  assignedStaffName: string;
  status: WorkspaceServiceJobStatus;
  title: string;
  description: string;
  serviceName: string;
  city: string;
  scheduledStartsAt: string;
  scheduledEndsAt: string;
  currency: string;
  totalMinor: number | null;
  completionSummary: string;
  completedAt: string;
  cancelledAt: string;
  createdAt: string;
  updatedAt: string;
};

export type DashboardWorkspaceServiceJobEvent = {
  id: string;
  eventType: string;
  fromStatus: string;
  toStatus: string;
  summary: string;
  createdAt: string;
};

export type DashboardWorkspaceServiceJobNote = {
  id: string;
  body: string;
  createdAt: string;
};

export type DashboardWorkspaceServiceJobAttachment = {
  id: string;
  kind: string;
  fileName: string;
  contentType: string;
  byteSize: number | null;
  createdAt: string;
};

export type DashboardWorkspaceServiceJobEvidence = {
  id: string;
  evidenceType: string;
  description: string;
  attachmentId: string;
  createdAt: string;
};

export type DashboardWorkspaceStaffOption = {
  id: string;
  name: string;
};

function mapJob(row: Record<string, unknown>): DashboardWorkspaceServiceJob {
  return {
    id: text(row.id),
    sourceType: text(row.source_type) as WorkspaceServiceJobSourceType,
    quoteRequestId: text(row.quote_request_id),
    quoteOfferId: text(row.quote_offer_id),
    bookingId: text(row.booking_id),
    customerId: text(row.customer_id),
    customerName: text(row.customer_name),
    assignedStaffId: text(row.assigned_staff_id),
    assignedStaffName: text(row.assigned_staff_name),
    status: text(row.status) as WorkspaceServiceJobStatus,
    title: text(row.title),
    description: text(row.description),
    serviceName: text(row.service_name),
    city: text(row.city),
    scheduledStartsAt: text(row.scheduled_starts_at),
    scheduledEndsAt: text(row.scheduled_ends_at),
    currency: text(row.currency),
    totalMinor: row.total_minor === null || row.total_minor === undefined ? null : Number(row.total_minor),
    completionSummary: text(row.completion_summary),
    completedAt: text(row.completed_at),
    cancelledAt: text(row.cancelled_at),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
  };
}

const serviceJobSelect = `
  select
    job.id,
    job.source_type,
    job.quote_request_id,
    job.quote_offer_id,
    job.booking_id,
    job.customer_id,
    coalesce(customer.name, quote_request.customer_name, '') as customer_name,
    job.assigned_staff_id,
    coalesce(staff.name, '') as assigned_staff_name,
    job.status,
    job.title,
    job.description,
    job.service_name,
    job.city,
    job.scheduled_starts_at,
    job.scheduled_ends_at,
    job.currency,
    job.total_minor,
    job.completion_summary,
    job.completed_at,
    job.cancelled_at,
    job.created_at,
    job.updated_at
  from workspace_service_jobs job
  left join customers customer
    on customer.id = job.customer_id
   and customer.workspace_id = job.workspace_id::text
  left join workspace_quote_requests quote_request
    on quote_request.id = job.quote_request_id
   and quote_request.workspace_id = job.workspace_id
  left join workspace_staff staff
    on staff.id = job.assigned_staff_id
   and staff.workspace_id = job.workspace_id::text
`;

export async function getDashboardWorkspaceServiceJobs() {
  const sql = getSqlClient();
  if (!sql) return [];
  const access = await getActiveWorkspaceAccess();
  const rows = await sql.query(`${serviceJobSelect}
    where job.workspace_id = $1::uuid
    order by
      case job.status
        when 'in_progress' then 0
        when 'assigned' then 1
        when 'new' then 2
        when 'completed' then 3
        else 4
      end,
      job.scheduled_starts_at asc nulls last,
      job.created_at desc`, [access.workspaceId]);
  return rows.map((row) => mapJob(row as Record<string, unknown>));
}

export async function getDashboardWorkspaceServiceJob(jobId: string) {
  if (!uuidPattern.test(jobId)) return null;
  const sql = getSqlClient();
  if (!sql) return null;
  const access = await getActiveWorkspaceAccess();
  const rows = await sql.query(`${serviceJobSelect}
    where job.workspace_id = $1::uuid
      and job.id = $2::uuid
    limit 1`, [access.workspaceId, jobId]);
  return rows[0] ? mapJob(rows[0] as Record<string, unknown>) : null;
}

export async function getDashboardWorkspaceServiceJobDetail(jobId: string) {
  if (!uuidPattern.test(jobId)) return null;
  const sql = getSqlClient();
  if (!sql) return null;
  const access = await getActiveWorkspaceAccess();
  const [jobs, eventRows, noteRows, attachmentRows, evidenceRows, staffRows] = await Promise.all([
    sql.query(`${serviceJobSelect}
      where job.workspace_id = $1::uuid
        and job.id = $2::uuid
      limit 1`, [access.workspaceId, jobId]),
    sql`
      select id, event_type, from_status, to_status, summary, created_at
      from workspace_service_job_events
      where workspace_id = ${access.workspaceId}::uuid
        and service_job_id = ${jobId}::uuid
      order by created_at desc
      limit 100
    `,
    sql`
      select id, body, created_at
      from workspace_service_job_notes
      where workspace_id = ${access.workspaceId}::uuid
        and service_job_id = ${jobId}::uuid
      order by created_at desc
      limit 100
    `,
    sql`
      select id, kind, file_name, content_type, byte_size, created_at
      from workspace_service_job_attachments
      where workspace_id = ${access.workspaceId}::uuid
        and service_job_id = ${jobId}::uuid
      order by created_at desc
      limit 100
    `,
    sql`
      select id, evidence_type, description, attachment_id, created_at
      from workspace_service_job_completion_evidence
      where workspace_id = ${access.workspaceId}::uuid
        and service_job_id = ${jobId}::uuid
      order by created_at desc
      limit 100
    `,
    sql`
      select id, name
      from workspace_staff
      where workspace_id = ${access.workspaceId}
        and is_active = true
      order by sort_order asc, name asc
    `,
  ]);

  if (!jobs[0]) return null;

  return {
    job: mapJob(jobs[0] as Record<string, unknown>),
    events: eventRows.map((row) => ({
      id: text(row.id),
      eventType: text(row.event_type),
      fromStatus: text(row.from_status),
      toStatus: text(row.to_status),
      summary: text(row.summary),
      createdAt: text(row.created_at),
    } satisfies DashboardWorkspaceServiceJobEvent)),
    notes: noteRows.map((row) => ({
      id: text(row.id),
      body: text(row.body),
      createdAt: text(row.created_at),
    } satisfies DashboardWorkspaceServiceJobNote)),
    attachments: attachmentRows.map((row) => ({
      id: text(row.id),
      kind: text(row.kind),
      fileName: text(row.file_name),
      contentType: text(row.content_type),
      byteSize: row.byte_size === null || row.byte_size === undefined ? null : Number(row.byte_size),
      createdAt: text(row.created_at),
    } satisfies DashboardWorkspaceServiceJobAttachment)),
    evidence: evidenceRows.map((row) => ({
      id: text(row.id),
      evidenceType: text(row.evidence_type),
      description: text(row.description),
      attachmentId: text(row.attachment_id),
      createdAt: text(row.created_at),
    } satisfies DashboardWorkspaceServiceJobEvidence)),
    staff: staffRows.map((row) => ({ id: text(row.id), name: text(row.name) } satisfies DashboardWorkspaceStaffOption)),
  };
}

export async function assignDashboardWorkspaceServiceJob(jobId: string, staffId: string) {
  if (!uuidPattern.test(jobId) || !uuidPattern.test(staffId)) throw new Error("Invalid service job assignment");
  const sql = getSqlClient();
  if (!sql) throw new Error("Missing database connection for service job assignment");
  const access = await getActiveWorkspaceAccess(true);

  const rows = await sql`
    with current_job as (
      select id, workspace_id, status, assigned_staff_id
      from workspace_service_jobs
      where id = ${jobId}::uuid
        and workspace_id = ${access.workspaceId}::uuid
        and status in ('new', 'assigned', 'in_progress')
      for update
    ),
    target_staff as (
      select
        current.id as job_id,
        current.workspace_id,
        current.status,
        current.assigned_staff_id,
        staff.id as staff_id
      from current_job current
      join workspace_staff staff
        on staff.id = ${staffId}::uuid
       and staff.workspace_id = current.workspace_id::text
       and staff.is_active = true
    ),
    assigned_job as (
      update workspace_service_jobs job
      set
        assigned_staff_id = target.staff_id,
        status = case when job.status = 'new' then 'assigned' else job.status end,
        updated_at = now()
      from target_staff target
      where job.id = target.job_id
        and job.workspace_id = target.workspace_id
        and job.assigned_staff_id is distinct from target.staff_id
      returning
        job.id,
        job.workspace_id,
        target.status as old_status,
        job.status as new_status,
        target.staff_id
    ),
    recorded_event as (
      insert into workspace_service_job_events (
        workspace_id, service_job_id, event_type, from_status, to_status, summary, metadata, actor_user_id
      )
      select
        workspace_id,
        id,
        'assigned',
        old_status,
        new_status,
        'Service job assigned to an active staff member.',
        jsonb_build_object('staff_id', staff_id),
        ${access.userId}
      from assigned_job
      returning id
    )
    select id from assigned_job
    union all
    select job_id as id
    from target_staff
    where assigned_staff_id = staff_id
    limit 1
  `;

  if (!rows[0]) throw new Error("Service job assignment did not match an active staff member");
}

export async function transitionDashboardWorkspaceServiceJob(
  jobId: string,
  nextStatus: WorkspaceServiceJobStatus,
  completionEvidence?: string,
) {
  if (!isWorkspaceServiceJobStatus(nextStatus)) throw new Error("Invalid service job status");
  if (!uuidPattern.test(jobId)) throw new Error("Invalid service job");
  const sql = getSqlClient();
  if (!sql) throw new Error("Missing database connection for service job status update");
  const access = await getActiveWorkspaceAccess(true);
  const currentRows = await sql`
    select status
    from workspace_service_jobs
    where id = ${jobId}::uuid
      and workspace_id = ${access.workspaceId}::uuid
    limit 1
  `;
  const currentStatus = text(currentRows[0]?.status) as WorkspaceServiceJobStatus;
  if (!isWorkspaceServiceJobStatus(currentStatus) || !canTransitionWorkspaceServiceJob(currentStatus, nextStatus)) {
    throw new Error("Invalid service job transition");
  }

  const evidence = nullableText(completionEvidence);
  if (nextStatus === "completed" && (!evidence || evidence.length > 5000)) {
    throw new Error("Completion evidence is required when completing a service job");
  }
  const statusSummary = `Service job status changed from ${currentStatus} to ${nextStatus}.`;

  const rows = await sql`
    with updated_job as (
      update workspace_service_jobs
      set
        status = ${nextStatus},
        completion_summary = case when ${nextStatus} = 'completed' then ${evidence} else completion_summary end,
        completed_at = case when ${nextStatus} = 'completed' then now() else completed_at end,
        cancelled_at = case when ${nextStatus} = 'cancelled' then now() else cancelled_at end,
        updated_at = now()
      where id = ${jobId}::uuid
        and workspace_id = ${access.workspaceId}::uuid
        and status = ${currentStatus}
      returning id, workspace_id, booking_id, customer_id
    ),
    recorded_event as (
      insert into workspace_service_job_events (
        workspace_id, service_job_id, event_type, from_status, to_status, summary, metadata, actor_user_id
      )
      select
        workspace_id,
        id,
        'status_changed',
        ${currentStatus},
        ${nextStatus},
        ${statusSummary},
        jsonb_build_object('source', 'dashboard'),
        ${access.userId}
      from updated_job
      returning id
    ),
    completion_evidence as (
      insert into workspace_service_job_completion_evidence (
        workspace_id, service_job_id, evidence_type, description, created_by_user_id
      )
      select workspace_id, id, 'note', ${evidence}, ${access.userId}
      from updated_job
      where ${nextStatus} = 'completed'
      returning id, workspace_id, service_job_id
    ),
    evidence_event as (
      insert into workspace_service_job_events (
        workspace_id, service_job_id, event_type, summary, metadata, actor_user_id
      )
      select
        workspace_id,
        service_job_id,
        'completion_evidence_added',
        'Completion evidence recorded.',
        jsonb_build_object('evidence_type', 'note'),
        ${access.userId}
      from completion_evidence
      returning id
    ),
    customer_timeline_event as (
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
        workspace_id::text,
        customer_id,
        booking_id,
        'status_change',
        'Service job updated',
        ${statusSummary},
        jsonb_build_object(
          'source', 'dashboard_service_job',
          'service_job_id', id,
          'from_status', ${currentStatus},
          'to_status', ${nextStatus}
        )
      from updated_job
      where customer_id is not null
      returning id
    ),
    synced_booking as (
      update bookings booking
      set
        status = case when ${nextStatus} = 'completed' then 'completed' else 'cancelled' end,
        updated_at = now()
      from updated_job job
      where booking.id = job.booking_id
        and booking.workspace_id = job.workspace_id::text
        and ${nextStatus} in ('completed', 'cancelled')
        and booking.status not in ('completed', 'cancelled', 'no_show')
      returning booking.id
    )
    select id, booking_id from updated_job
  `;

  if (!rows[0]) throw new Error("Service job status did not update");

  const bookingId = text(rows[0].booking_id);
  if (nextStatus === "completed" && bookingId) {
    try {
      await deliverVerifiedReviewInvitation(bookingId);
    } catch (error) {
      console.error("Failed to deliver verified review invitation after service job completion", error);
    }
  }
}

export async function addDashboardWorkspaceServiceJobNote(jobId: string, body: string) {
  const note = nullableText(body);
  if (!note || note.length > 5000) throw new Error("Service job note must be between 1 and 5000 characters");
  if (!uuidPattern.test(jobId)) throw new Error("Invalid service job");
  const sql = getSqlClient();
  if (!sql) throw new Error("Missing database connection for service job notes");
  const access = await getActiveWorkspaceAccess(true);

  const rows = await sql`
    with inserted_note as (
      insert into workspace_service_job_notes (workspace_id, service_job_id, body, author_user_id)
      select ${access.workspaceId}::uuid, job.id, ${note}, ${access.userId}
      from workspace_service_jobs job
      where job.id = ${jobId}::uuid
        and job.workspace_id = ${access.workspaceId}::uuid
      returning id, workspace_id, service_job_id
    ),
    recorded_event as (
      insert into workspace_service_job_events (
        workspace_id, service_job_id, event_type, summary, metadata, actor_user_id
      )
      select
        workspace_id,
        service_job_id,
        'note_added',
        'Service job note added.',
        jsonb_build_object('note_id', id),
        ${access.userId}
      from inserted_note
      returning id
    )
    select id from inserted_note
  `;

  if (!rows[0]) throw new Error("Service job note did not match the active workspace");
}
