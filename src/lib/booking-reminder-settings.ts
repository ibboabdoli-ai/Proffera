import "server-only";

import { neon } from "@neondatabase/serverless";

import { resolveDatabaseUrl } from "@/lib/db/database-url";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString = resolveDatabaseUrl();

export type BookingReminderSettings = {
  isEnabled: boolean;
  hoursBefore: number;
  emailEnabled: boolean;
  smsEnabled: boolean;
  customerRescheduleEnabled: boolean;
  customerCancelEnabled: boolean;
  cancelNoticeHours: number;
  noShowEnabled: boolean;
  autoCompleteEnabled: boolean;
  companyConfirmationRequired: boolean;
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
  const rows = await sql`select is_enabled, hours_before, email_enabled, sms_enabled,
    customer_reschedule_enabled, customer_cancel_enabled, cancel_notice_hours,
    no_show_enabled, auto_complete_enabled, company_confirmation_required
    from workspace_booking_reminder_settings where workspace_id = ${access.workspaceId} limit 1`;
  const row = rows[0];
  return {
    isEnabled: row ? Boolean(row.is_enabled) : true,
    hoursBefore: row ? Number(row.hours_before) : 24,
    emailEnabled: row ? Boolean(row.email_enabled) : true,
    smsEnabled: row ? Boolean(row.sms_enabled) : true,
    customerRescheduleEnabled: row ? Boolean(row.customer_reschedule_enabled) : true,
    customerCancelEnabled: row ? Boolean(row.customer_cancel_enabled) : true,
    cancelNoticeHours: row ? Number(row.cancel_notice_hours) : 0,
    noShowEnabled: row ? Boolean(row.no_show_enabled) : true,
    autoCompleteEnabled: row ? Boolean(row.auto_complete_enabled) : false,
    companyConfirmationRequired: row ? Boolean(row.company_confirmation_required) : true,
  };
}

export async function updateBookingReminderSettings(input: BookingReminderSettings) {
  const access = await requireManager();
  if (!Number.isInteger(input.hoursBefore) || input.hoursBefore < 1 || input.hoursBefore > 168) throw new Error("Invalid reminder lead time");
  if (!Number.isInteger(input.cancelNoticeHours) || input.cancelNoticeHours < 0 || input.cancelNoticeHours > 720) throw new Error("Invalid cancellation notice");
  const sql = neon(connectionString!);
  await sql`insert into workspace_booking_reminder_settings (
      workspace_id, is_enabled, hours_before, email_enabled, sms_enabled,
      customer_reschedule_enabled, customer_cancel_enabled, cancel_notice_hours,
      no_show_enabled, auto_complete_enabled, company_confirmation_required, updated_at)
    values (${access.workspaceId}, ${input.isEnabled}, ${input.hoursBefore}, ${input.emailEnabled}, ${input.smsEnabled},
      ${input.customerRescheduleEnabled}, ${input.customerCancelEnabled}, ${input.cancelNoticeHours},
      ${input.noShowEnabled}, ${input.autoCompleteEnabled}, ${input.companyConfirmationRequired}, now())
    on conflict (workspace_id) do update set
      is_enabled=excluded.is_enabled, hours_before=excluded.hours_before,
      email_enabled=excluded.email_enabled, sms_enabled=excluded.sms_enabled,
      customer_reschedule_enabled=excluded.customer_reschedule_enabled,
      customer_cancel_enabled=excluded.customer_cancel_enabled,
      cancel_notice_hours=excluded.cancel_notice_hours,
      no_show_enabled=excluded.no_show_enabled,
      auto_complete_enabled=excluded.auto_complete_enabled,
      company_confirmation_required=excluded.company_confirmation_required,
      updated_at=now()`;
}

export async function getRecentReminderDeliveries() {
  const access = await requireManager();
  const sql = neon(connectionString!);
  const rows = await sql`select d.id, d.channel, d.status, d.scheduled_for, d.attempted_at, d.sent_at, d.error_message,
      b.starts_at, coalesce(b.service, 'Bokning') as service, coalesce(c.name, 'Kund') as customer_name
    from booking_reminder_deliveries d join bookings b on b.id=d.booking_id and b.workspace_id=d.workspace_id
    left join customers c on c.id=b.customer_id and c.workspace_id=b.workspace_id
    where d.workspace_id=${access.workspaceId} order by d.created_at desc limit 50`;
  return rows.map((row) => ({ id:String(row.id), channel:String(row.channel), status:String(row.status),
    scheduledFor:new Date(String(row.scheduled_for)).toISOString(), attemptedAt:row.attempted_at?new Date(String(row.attempted_at)).toISOString():"",
    sentAt:row.sent_at?new Date(String(row.sent_at)).toISOString():"", errorMessage:String(row.error_message??""),
    startsAt:new Date(String(row.starts_at)).toISOString(), service:String(row.service), customerName:String(row.customer_name) }));
}
