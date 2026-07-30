-- Customer website review workflow.
-- Reviews are submitted publicly, then published only after workspace moderation.

create table if not exists website_reviews (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces (id) on delete cascade,
  reviewer_name text not null,
  rating integer not null,
  service text,
  area text,
  message text not null,
  status text not null default 'pending',
  moderated_at timestamptz,
  moderated_by_user_id text references "user" (id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_reviews_rating_check check (rating between 1 and 5),
  constraint website_reviews_status_check check (status in ('pending', 'approved', 'rejected')),
  constraint website_reviews_reviewer_name_check check (char_length(btrim(reviewer_name)) between 2 and 80),
  constraint website_reviews_message_check check (char_length(btrim(message)) between 10 and 1000),
  constraint website_reviews_service_length_check check (service is null or char_length(service) <= 120),
  constraint website_reviews_area_length_check check (area is null or char_length(area) <= 120)
);

create index if not exists website_reviews_workspace_status_published_idx
  on website_reviews (workspace_id, status, published_at desc, created_at desc);
