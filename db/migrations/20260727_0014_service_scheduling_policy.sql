alter table workspace_services
  add column if not exists buffer_before_minutes integer not null default 0,
  add column if not exists buffer_after_minutes integer not null default 0,
  add column if not exists minimum_notice_minutes integer not null default 0,
  add column if not exists maximum_advance_days integer not null default 365;

alter table workspace_services
  drop constraint if exists workspace_services_buffer_before_minutes_check,
  add constraint workspace_services_buffer_before_minutes_check
    check (buffer_before_minutes between 0 and 1440),
  drop constraint if exists workspace_services_buffer_after_minutes_check,
  add constraint workspace_services_buffer_after_minutes_check
    check (buffer_after_minutes between 0 and 1440),
  drop constraint if exists workspace_services_minimum_notice_minutes_check,
  add constraint workspace_services_minimum_notice_minutes_check
    check (minimum_notice_minutes between 0 and 525600),
  drop constraint if exists workspace_services_maximum_advance_days_check,
  add constraint workspace_services_maximum_advance_days_check
    check (maximum_advance_days between 1 and 730);
