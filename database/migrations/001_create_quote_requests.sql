create table if not exists quote_requests (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  service_type text not null,
  city text not null,
  postal_code text not null,
  description text not null,
  preferred_date text not null,
  contact_name text not null,
  contact_email text not null,
  contact_phone text not null,
  consent_accepted boolean not null default false,
  status text not null default 'submitted',
  reference_id text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_requests_status_check check (
    status in (
      'draft',
      'submitted',
      'pending_review',
      'approved',
      'matched',
      'answered',
      'booked',
      'completed',
      'cancelled',
      'rejected'
    )
  )
);

create index if not exists quote_requests_status_idx on quote_requests (status);
create index if not exists quote_requests_city_idx on quote_requests (city);
create index if not exists quote_requests_category_idx on quote_requests (category);
create index if not exists quote_requests_created_at_idx on quote_requests (created_at desc);
