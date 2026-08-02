import "server-only";

import { neon } from "@neondatabase/serverless";

import { sendBookingReminderEmail } from "@/features/email/booking-reminder-email";
import { sendBookingReminderSms } from "@/features/sms/booking-reminder-sms";
import { resolveBookingTimeZone } from "@/lib/public-booking-policy";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? process.env.POSTGRES_PRISMA_URL ?? process.env.POSTGRES_URL_NON_POOLING;

type ReminderRow = { booking_id: string; workspace_id: string; workspace_name: string; customer_name: string; customer_email: string; customer_phone: string; service: string; city: string; starts_at: string; time_zone: string; hours_before: number; email_enabled: boolean; sms_enabled: boolean };

export async function processBookingReminders() {
  if (!connectionString) throw new Error("Missing database connection");
  const sql = neon(connectionString);
  const rows = await sql`
    select b.id as booking_id, b.workspace_id, coalesce(w.name, b.workspace_id) as workspace_name,
      coalesce(c.name, 'Kund') as customer_name, coalesce(c.email, '') as customer_email,
      coalesce(c.phone, '') as customer_phone, coalesce(b.service, 'Bokning') as service,
      coalesce(b.city, '') as city, b.starts_at,
      coalesce(nullif(ws.time_zone, ''), 'Europe/Stockholm') as time_zone,
      coalesce(s.hours_before, 24) as hours_before,
      coalesce(s.email_enabled, true) as email_enabled,
      coalesce(s.sms_enabled, true) as sms_enabled
    from bookings b
    left join customers c on c.id = b.customer_id and c.workspace_id = b.workspace_id
    left join workspaces w on w.id = b.workspace_id
    left join workspace_settings ws on ws.workspace_id = b.workspace_id
    left join workspace_booking_reminder_settings s on s.workspace_id = b.workspace_id
    where b.status = 'confirmed'
      and b.source not in ('dashboard_availability_block', 'dashboard_availability_recurring_block')
      and coalesce(s.is_enabled, true) = true
      and b.starts_at > now()
      and b.starts_at <= now() + (coalesce(s.hours_before, 24) || ' hours')::interval
      and b.starts_at > now() + (greatest(coalesce(s.hours_before, 24) - 1, 0) || ' hours')::interval
    order by b.starts_at asc
    limit 250
  `;

  let sent = 0; let skipped = 0; let failed = 0;
  for (const raw of rows as unknown as ReminderRow[]) {
    const timeZone = resolveBookingTimeZone(raw.time_zone);
    const scheduledFor = new Date(new Date(String(raw.starts_at)).getTime() - Number(raw.hours_before) * 3600000).toISOString();
    const channels = [raw.email_enabled && raw.customer_email ? "email" : null, raw.sms_enabled && raw.customer_phone ? "sms" : null].filter(Boolean) as ("email" | "sms")[];
    for (const channel of channels) {
      const claimed = await sql`
        insert into booking_reminder_deliveries (workspace_id, booking_id, channel, scheduled_for, status, attempted_at)
        values (${String(raw.workspace_id)}, ${String(raw.booking_id)}::uuid, ${channel}, ${scheduledFor}::timestamptz, 'pending', now())
        on conflict do nothing returning id
      `;
      if (!claimed[0]) { skipped += 1; continue; }
      const result = channel === "email"
        ? await sendBookingReminderEmail({ customerName: String(raw.customer_name), customerEmail: String(raw.customer_email), companyName: String(raw.workspace_name), service: String(raw.service), startsAt: new Date(String(raw.starts_at)).toISOString(), city: String(raw.city), timeZone })
        : await sendBookingReminderSms({ customerPhone: String(raw.customer_phone), companyName: String(raw.workspace_name), service: String(raw.service), startsAt: new Date(String(raw.starts_at)).toISOString(), timeZone });
      const status = result.ok ? "sent" : result.skipped ? "skipped" : "failed";
      await sql`update booking_reminder_deliveries set status = ${status}, provider_id = ${result.ok ? result.providerId : null}, error_message = ${result.ok ? "" : result.message}, sent_at = ${result.ok ? new Date().toISOString() : null}::timestamptz, updated_at = now() where id = ${String(claimed[0].id)}::uuid`;
      if (status === "sent") sent += 1; else if (status === "skipped") skipped += 1; else failed += 1;
    }
  }
  return { checked: rows.length, sent, skipped, failed };
}
