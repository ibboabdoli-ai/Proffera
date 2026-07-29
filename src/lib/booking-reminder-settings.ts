import "server-only";

import { neon } from "@neondatabase/serverless";

import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL_NON_POOLING;

export type BookingReminderSettings = {
  isEnabled: boolean;
  hoursBefore: number;
  emailEnabled: boolean;
  smsEnabled: boolean;
};

async function requireManager() {
  if (!connectionString) throw new Error("Missing database connection");
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) throw new Error("Owner or admin access required");
  return access;
}

export async function getBookingReminderSettings(): Promise<BookingReminderSettings> {
  const access = await requireManager();
  const sql = neon(connectionString!);
  const rows = await sql`
    select is_enabled, hours_before, email_enabled, sms_enabled
    from workspace_booking_reminder_settings
    where workspace_id = ${access.workspaceId}
    limit 1
  `;
  const row = rows[0];
  return {
    isEnabled: row ? Boolean(row.is_enabled) : true,
    hoursBefore: row ? Number(row.hours_before) : 24,
    emailEnabled: row ? Boolean(row.email_enabled) : true,
    smsEnabled: row ? Boolean(row.sms_enabled) : true,
  };
}

export async function updateBookingReminderSettings(input: BookingReminderSettings) {
  const access = await requireManager();
  if (!Number.isInteger(input.hoursBefore) || input.hoursBefore < 1 || input.hoursBefore > 168) throw new Error("Invalid reminder lead time");
  const sql = neon(connectionString!);
  await sql`
    insert into workspace_booking_reminder_settings (workspace_id, is_enabled, hours_before, email_enabled, sms_enabled, updated_at)
    values (${access.workspaceId}, ${input.isEnabled}, ${input.hoursBefore}, ${input.emailEnabled}, ${input.smsEnabled}, now())
    on conflict (workspace_id) do update set
      is_enabled = excluded.is_enabled,
      hours_before = excluded.hours_before,
      email_enabled = excluded.email_enabled,
      sms_enabled = excluded.sms_enabled,
      updated_at = now()
  `;
}

export async function getRecentReminderDeliveries() {
  const access = await requireManager();
  const sql = neon(connectionString!);
  const rows = await sql`
    select d.id, d.channel, d.status, d.scheduled_for, d.attempted_at, d.sent_at, d.error_message,
      b.starts_at, coalesce(b.service, 'Bokning') as service, coalesce(c.name, 'Kund') as customer_name
    from booking_reminder_deliveries d
    join bookings b on b.id = d.booking_id and b.workspace_id = d.workspace_id
    left join customers c on c.id = b.customer_id and c.workspace_id = b.workspace_id
    where d.workspace_id = ${access.workspaceId}
    order by d.created_at desc
    limit 50
  `;
  return rows.map((row) => ({
    id: String(row.id),
    channel: String(row.channel),
    status: String(row.status),
    scheduledFor: new Date(String(row.scheduled_for)).toISOString(),
    attemptedAt: row.attempted_at ? new Date(String(row.attempted_at)).toISOString() : "",
    sentAt: row.sent_at ? new Date(String(row.sent_at)).toISOString() : "",
    errorMessage: String(row.error_message ?? ""),
    startsAt: new Date(String(row.starts_at)).toISOString(),
    service: String(row.service),
    customerName: String(row.customer_name),
  }));
}
