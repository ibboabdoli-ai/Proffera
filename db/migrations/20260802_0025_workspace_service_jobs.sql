-- Shared fulfillment backbone for confirmed bookings and accepted quote offers.
-- A source may create at most one workspace-owned service job.

create table if not exists workspace_service_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  source_type text not null,
  quote_request_id uuid references workspace_quote_requests(id) on delete cascade,
  quote_offer_id uuid references workspace_quote_offers(id) on delete cascade,
  booking_id uuid references bookings(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  assigned_staff_id uuid references workspace_staff(id) on delete set null,
  status text not null default 'new',
  title text not null,
  description text not null default '',
  service_name text,
  city text,
  scheduled_starts_at timestamptz,
  scheduled_ends_at timestamptz,
  currency text,
  total_minor bigint,
  completion_summary text,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspace_service_jobs_source_type_check
    check (source_type in ('quote_offer', 'booking')),
  constraint workspace_service_jobs_status_check
    check (status in ('new', 'assigned', 'in_progress', 'completed', 'cancelled')),
  constraint workspace_service_jobs_source_check
    check (
      (source_type = 'quote_offer' and quote_request_id is not null and quote_offer_id is not null and booking_id is null)
      or (source_type = 'booking' and booking_id is not null and quote_request_id is null and quote_offer_id is null)
    ),
  constraint workspace_service_jobs_schedule_check
    check (scheduled_ends_at is null or scheduled_starts_at is null or scheduled_ends_at > scheduled_starts_at),
  constraint workspace_service_jobs_total_minor_check
    check (total_minor is null or total_minor >= 0)
);

create unique index if not exists workspace_service_jobs_quote_offer_unique
  on workspace_service_jobs (quote_offer_id)
  where quote_offer_id is not null;

create unique index if not exists workspace_service_jobs_booking_unique
  on workspace_service_jobs (booking_id)
  where booking_id is not null;

create index if not exists workspace_service_jobs_workspace_status_idx
  on workspace_service_jobs (workspace_id, status, created_at desc);

create index if not exists workspace_service_jobs_workspace_staff_idx
  on workspace_service_jobs (workspace_id, assigned_staff_id, status)
  where assigned_staff_id is not null;

create table if not exists workspace_service_job_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  service_job_id uuid not null references workspace_service_jobs(id) on delete cascade,
  event_type text not null,
  from_status text,
  to_status text,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  actor_user_id text,
  created_at timestamptz not null default now(),
  constraint workspace_service_job_events_type_check
    check (event_type in ('created', 'assigned', 'status_changed', 'note_added', 'attachment_added', 'completion_evidence_added'))
);

create index if not exists workspace_service_job_events_job_created_idx
  on workspace_service_job_events (service_job_id, created_at desc);

create table if not exists workspace_service_job_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  service_job_id uuid not null references workspace_service_jobs(id) on delete cascade,
  body text not null,
  author_user_id text,
  created_at timestamptz not null default now(),
  constraint workspace_service_job_notes_body_check
    check (length(trim(body)) between 1 and 5000)
);

create index if not exists workspace_service_job_notes_job_created_idx
  on workspace_service_job_notes (service_job_id, created_at desc);

create table if not exists workspace_service_job_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  service_job_id uuid not null references workspace_service_jobs(id) on delete cascade,
  kind text not null default 'attachment',
  file_name text not null,
  storage_key text not null,
  content_type text,
  byte_size bigint,
  uploaded_by_user_id text,
  created_at timestamptz not null default now(),
  constraint workspace_service_job_attachments_kind_check
    check (kind in ('attachment', 'completion_evidence')),
  constraint workspace_service_job_attachments_file_name_check
    check (length(trim(file_name)) between 1 and 255),
  constraint workspace_service_job_attachments_storage_key_check
    check (length(trim(storage_key)) between 1 and 1000),
  constraint workspace_service_job_attachments_byte_size_check
    check (byte_size is null or byte_size >= 0)
);

create index if not exists workspace_service_job_attachments_job_created_idx
  on workspace_service_job_attachments (service_job_id, created_at desc);

create table if not exists workspace_service_job_completion_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  service_job_id uuid not null references workspace_service_jobs(id) on delete cascade,
  evidence_type text not null,
  description text,
  attachment_id uuid references workspace_service_job_attachments(id) on delete cascade,
  created_by_user_id text,
  created_at timestamptz not null default now(),
  constraint workspace_service_job_completion_evidence_type_check
    check (evidence_type in ('note', 'attachment')),
  constraint workspace_service_job_completion_evidence_payload_check
    check (
      (evidence_type = 'note' and attachment_id is null and length(trim(coalesce(description, ''))) between 1 and 5000)
      or (evidence_type = 'attachment' and attachment_id is not null)
    )
);

create index if not exists workspace_service_job_completion_evidence_job_created_idx
  on workspace_service_job_completion_evidence (service_job_id, created_at desc);

-- Backfill the already-confirmed booking workflow. Non-UUID historical workspace
-- identifiers are deliberately skipped rather than cast unsafely.
with inserted_jobs as (
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
    workspace.id,
    'booking',
    booking.id,
    booking.customer_id,
    booking.staff_id,
    case when booking.staff_id is null then 'new' else 'assigned' end,
    booking.title,
    coalesce(booking.notes, ''),
    booking.service,
    booking.city,
    booking.starts_at,
    booking.ends_at
  from bookings booking
  join workspaces workspace
    on workspace.id = case
      when booking.workspace_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then booking.workspace_id::uuid
    end
  where booking.status = 'confirmed'
  on conflict (booking_id) where booking_id is not null do nothing
  returning id, workspace_id, booking_id, customer_id, assigned_staff_id
)
insert into workspace_service_job_events (
  workspace_id,
  service_job_id,
  event_type,
  to_status,
  summary,
  metadata
)
select
  workspace_id,
  id,
  'created',
  case when assigned_staff_id is null then 'new' else 'assigned' end,
  'Service job created from confirmed booking.',
  jsonb_build_object('source', 'confirmed_booking_backfill', 'booking_id', booking_id)
from inserted_jobs;

-- Accepted offers created before this migration receive a job too. The regular
-- acceptance path below supplies customer linkage for new accepted offers.
with inserted_jobs as (
  insert into workspace_service_jobs (
    workspace_id,
    source_type,
    quote_request_id,
    quote_offer_id,
    status,
    title,
    description,
    service_name,
    city,
    currency,
    total_minor
  )
  select
    offer.workspace_id,
    'quote_offer',
    request.id,
    offer.id,
    'new',
    offer.title,
    request.description,
    offer.title,
    request.city,
    offer.currency,
    offer.total_minor
  from workspace_quote_offers offer
  join workspace_quote_requests request
    on request.id = offer.quote_request_id
   and request.workspace_id = offer.workspace_id
  where offer.status = 'accepted'
    and request.status = 'accepted'
  on conflict (quote_offer_id) where quote_offer_id is not null do nothing
  returning id, workspace_id, quote_offer_id
)
insert into workspace_service_job_events (
  workspace_id,
  service_job_id,
  event_type,
  to_status,
  summary,
  metadata
)
select
  workspace_id,
  id,
  'created',
  'new',
  'Service job created from accepted quote offer.',
  jsonb_build_object('source', 'accepted_quote_backfill', 'quote_offer_id', quote_offer_id)
from inserted_jobs;

comment on table workspace_service_jobs is
  'One workspace-owned fulfillment job per confirmed booking or accepted direct quote offer.';
