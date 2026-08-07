import "server-only";

import { neon } from "@neondatabase/serverless";

import { resolveDatabaseUrl } from "@/lib/db/database-url";

import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  resolveDatabaseUrl()_NON_POOLING;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSqlClient() {
  return connectionString ? neon(connectionString) : null;
}

async function getWorkspaceAccess(requireManager = false) {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || (requireManager && !canManageWorkspaceSettings(access))) {
    throw new Error(requireManager ? "Workspace manager access is required for service job attachments" : "Workspace access is required for service job attachments");
  }
  return access;
}

export type DashboardServiceJobAttachment = {
  id: string;
  fileName: string;
  contentType: string;
  byteSize: number | null;
  createdAt: string;
};

export async function getDashboardServiceJobAttachments(jobId: string): Promise<DashboardServiceJobAttachment[]> {
  if (!uuidPattern.test(jobId)) return [];
  const sql = getSqlClient();
  if (!sql) return [];
  const access = await getWorkspaceAccess();

  const rows = await sql`
    select attachment.id, attachment.file_name, attachment.content_type, attachment.byte_size, attachment.created_at
    from workspace_service_job_attachments attachment
    join workspace_service_jobs job
      on job.id = attachment.service_job_id
     and job.workspace_id = attachment.workspace_id
    where attachment.workspace_id = ${access.workspaceId}::uuid
      and attachment.service_job_id = ${jobId}::uuid
    order by attachment.created_at desc
    limit 100
  `;

  return rows.map((row) => ({
    id: String(row.id),
    fileName: String(row.file_name ?? "Bilaga"),
    contentType: String(row.content_type ?? ""),
    byteSize: row.byte_size === null || row.byte_size === undefined ? null : Number(row.byte_size),
    createdAt: String(row.created_at),
  }));
}

export async function getDashboardServiceJobAttachmentUrl(attachmentId: string) {
  if (!uuidPattern.test(attachmentId)) return null;
  const sql = getSqlClient();
  if (!sql) return null;
  const access = await getWorkspaceAccess();

  const rows = await sql`
    select storage_key
    from workspace_service_job_attachments
    where id = ${attachmentId}::uuid
      and workspace_id = ${access.workspaceId}::uuid
    limit 1
  `;

  const storageKey = String(rows[0]?.storage_key ?? "");
  if (!storageKey) return null;

  try {
    const url = new URL(storageKey);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".blob.vercel-storage.com")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function createDashboardServiceJobAttachment(input: {
  jobId: string;
  fileName: string;
  storageKey: string;
  contentType: string;
  byteSize: number;
}) {
  if (!uuidPattern.test(input.jobId)) throw new Error("Invalid service job attachment target");
  const sql = getSqlClient();
  if (!sql) throw new Error("Missing database connection for service job attachment");
  const access = await getWorkspaceAccess(true);

  const rows = await sql`
    with inserted_attachment as (
      insert into workspace_service_job_attachments (
        workspace_id,
        service_job_id,
        kind,
        file_name,
        storage_key,
        content_type,
        byte_size,
        uploaded_by_user_id
      )
      select
        ${access.workspaceId}::uuid,
        job.id,
        'attachment',
        ${input.fileName},
        ${input.storageKey},
        ${input.contentType},
        ${input.byteSize},
        ${access.userId}
      from workspace_service_jobs job
      where job.id = ${input.jobId}::uuid
        and job.workspace_id = ${access.workspaceId}::uuid
      returning id, workspace_id, service_job_id
    ),
    recorded_event as (
      insert into workspace_service_job_events (
        workspace_id,
        service_job_id,
        event_type,
        summary,
        metadata,
        actor_user_id
      )
      select
        workspace_id,
        service_job_id,
        'attachment_added',
        'Service job attachment added.',
        jsonb_build_object('attachment_id', id, 'file_name', ${input.fileName}),
        ${access.userId}
      from inserted_attachment
      returning id
    )
    select id from inserted_attachment
  `;

  if (!rows[0]) throw new Error("Service job attachment did not match the active workspace");
  return String(rows[0].id);
}
