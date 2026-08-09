-- Public Business Hub foundation.
--
-- Adds public presentation metadata to the existing workspace service source of
-- truth, hardens service identity through booking/verification/job flows, and
-- keeps existing custom-domain roots booking-first unless a workspace opts in
-- to the public business site.

begin;

alter table workspace_services
  add column if not exists public_slug text,
  add column if not exists public_status text not null default 'draft',
  add column if not exists conversion_mode text not null default 'book',
  add column if not exists short_description text not null default '',
  add column if not exists seo_title text not null default '',
  add column if not exists seo_description text not null default '';

alter table workspace_services
  drop constraint if exists workspace_services_public_status_check;
alter table workspace_services
  add constraint workspace_services_public_status_check
  check (public_status in ('draft', 'published', 'hidden'))
  not valid;
alter table workspace_services validate constraint workspace_services_public_status_check;

alter table workspace_services
  drop constraint if exists workspace_services_conversion_mode_check;
alter table workspace_services
  add constraint workspace_services_conversion_mode_check
  check (conversion_mode in ('book', 'quote', 'book_or_quote', 'contact'))
  not valid;
alter table workspace_services validate constraint workspace_services_conversion_mode_check;

alter table workspace_services
  drop constraint if exists workspace_services_public_slug_check;
alter table workspace_services
  add constraint workspace_services_public_slug_check
  check (
    public_slug is null
    or (
      char_length(public_slug) between 2 and 120
      and public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    )
  )
  not valid;
alter table workspace_services validate constraint workspace_services_public_slug_check;

alter table workspace_services
  drop constraint if exists workspace_services_public_copy_check;
alter table workspace_services
  add constraint workspace_services_public_copy_check
  check (
    char_length(short_description) <= 280
    and char_length(seo_title) <= 180
    and char_length(seo_description) <= 320
  )
  not valid;
alter table workspace_services validate constraint workspace_services_public_copy_check;

alter table workspace_services
  drop constraint if exists workspace_services_published_slug_check;
alter table workspace_services
  add constraint workspace_services_published_slug_check
  check (public_status <> 'published' or public_slug is not null)
  not valid;
alter table workspace_services validate constraint workspace_services_published_slug_check;

create unique index if not exists workspace_services_workspace_public_slug_unique_idx
  on workspace_services (workspace_id, public_slug)
  where public_slug is not null;

create unique index if not exists workspace_services_id_workspace_unique_idx
  on workspace_services (id, workspace_id);

alter table bookings
  add column if not exists service_id uuid;

update bookings booking
set service_id = service.id
from workspace_services service
where booking.service_id is null
  and service.workspace_id = booking.workspace_id
  and service.name = booking.service;

alter table bookings
  drop constraint if exists bookings_service_ws_fk;
alter table bookings
  add constraint bookings_service_ws_fk
  foreign key (service_id, workspace_id)
  references workspace_services (id, workspace_id)
  on delete set null (service_id)
  not valid;
alter table bookings validate constraint bookings_service_ws_fk;

create index if not exists bookings_workspace_service_idx
  on bookings (workspace_id, service_id, starts_at desc)
  where service_id is not null;

alter table public_booking_verifications
  add column if not exists service_id uuid;

update public_booking_verifications verification
set service_id = service.id
from workspace_services service
where verification.service_id is null
  and service.workspace_id = verification.workspace_id::text
  and service.name = verification.service_name;

alter table public_booking_verifications
  drop constraint if exists public_booking_verifications_service_fk;
alter table public_booking_verifications
  add constraint public_booking_verifications_service_fk
  foreign key (service_id)
  references workspace_services (id)
  on delete set null
  not valid;
alter table public_booking_verifications validate constraint public_booking_verifications_service_fk;

create index if not exists public_booking_verifications_workspace_service_idx
  on public_booking_verifications (workspace_id, service_id, starts_at)
  where service_id is not null and consumed_at is null;

alter table workspace_service_jobs
  add column if not exists service_id uuid;

update workspace_service_jobs job
set service_id = coalesce(booking.service_id, quote_request.service_id, service.id)
from workspaces workspace
left join bookings booking
  on booking.id = job.booking_id
 and booking.workspace_id = workspace.id::text
left join workspace_quote_requests quote_request
  on quote_request.id = job.quote_request_id
 and quote_request.workspace_id = workspace.id
left join workspace_services service
  on service.workspace_id = workspace.id::text
 and service.name = job.service_name
where job.workspace_id = workspace.id
  and job.service_id is null;

alter table workspace_service_jobs
  drop constraint if exists workspace_service_jobs_service_fk;
alter table workspace_service_jobs
  add constraint workspace_service_jobs_service_fk
  foreign key (service_id)
  references workspace_services (id)
  on delete set null
  not valid;
alter table workspace_service_jobs validate constraint workspace_service_jobs_service_fk;

create index if not exists workspace_service_jobs_workspace_service_idx
  on workspace_service_jobs (workspace_id, service_id, created_at desc)
  where service_id is not null;

alter table workspace_experience_settings
  add column if not exists public_home_mode text not null default 'booking',
  add column if not exists business_intro text not null default '';

alter table workspace_experience_settings
  drop constraint if exists workspace_experience_public_home_mode_check;
alter table workspace_experience_settings
  add constraint workspace_experience_public_home_mode_check
  check (public_home_mode in ('booking', 'website'))
  not valid;
alter table workspace_experience_settings validate constraint workspace_experience_public_home_mode_check;

alter table workspace_experience_settings
  drop constraint if exists workspace_experience_business_intro_check;
alter table workspace_experience_settings
  add constraint workspace_experience_business_intro_check
  check (char_length(business_intro) <= 2000)
  not valid;
alter table workspace_experience_settings validate constraint workspace_experience_business_intro_check;

create table if not exists public_business_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  service_id uuid references workspace_services(id) on delete set null,
  event_key text not null,
  path text not null default '',
  session_key text not null default '',
  referrer text not null default '',
  created_at timestamptz not null default now(),
  constraint public_business_events_event_key_check
    check (event_key in ('business_view', 'service_view', 'book_clicked', 'quote_clicked', 'contact_clicked')),
  constraint public_business_events_text_check
    check (
      char_length(path) <= 500
      and char_length(session_key) <= 120
      and char_length(referrer) <= 1000
    )
);

create index if not exists public_business_events_workspace_created_idx
  on public_business_events (workspace_id, created_at desc);

create index if not exists public_business_events_workspace_service_created_idx
  on public_business_events (workspace_id, service_id, created_at desc)
  where service_id is not null;

comment on column workspace_services.public_status is
  'Public Business Hub publication state. Operational is_active remains independent.';
comment on column workspace_services.conversion_mode is
  'Customer action shown for a published service: book, quote, both, or contact.';
comment on column bookings.service_id is
  'Stable workspace service identity. The legacy service text remains the historical display snapshot.';
comment on column public_booking_verifications.service_id is
  'Stable service identity carried through the short-lived email-verification flow.';
comment on column workspace_service_jobs.service_id is
  'Stable service identity where known. service_name remains the historical display snapshot.';
comment on column workspace_experience_settings.public_home_mode is
  'Custom-domain root mode. Existing workspaces stay booking-first by default.';
comment on table public_business_events is
  'Minimal first-party funnel telemetry for the public business hub. No customer PII is stored.';

commit;
