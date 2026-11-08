-- Bring the canonical migration chain in line with existing lifecycle
-- settings used by the customer portal and manager UI. Additive and
-- idempotent; this file does not apply any Production migration by itself.
alter table workspace_booking_reminder_settings
  add column if not exists customer_reschedule_enabled boolean not null default true,
  add column if not exists customer_cancel_enabled boolean not null default true,
  add column if not exists cancel_notice_hours integer not null default 0 check (cancel_notice_hours between 0 and 720),
  add column if not exists no_show_enabled boolean not null default true,
  add column if not exists auto_complete_enabled boolean not null default false,
  add column if not exists company_confirmation_required boolean not null default true;
