-- Historical prerequisites for the central Verified Review schema.
--
-- `website_reviews` itself must come from the canonical repository migration
-- `db/migrations/20260729_0019_website_reviews.sql`; do not duplicate that table
-- here. The secure invitation/verified columns were introduced against an
-- already-applied Production schema (PR #344 records external migration
-- `be9c680f-7bb5-4f07-a4a6-8690e1fbe71f`), but that migration SQL is not present
-- in the active repository migration tree. Keep this fixture limited to that
-- genuinely external prerequisite surface plus the audit table required by the
-- exercised Marketplace application path.

create table admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id text,
  action text not null,
  reason text not null default '',
  new_value jsonb,
  created_at timestamptz not null default now()
);

create table website_review_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  booking_id uuid not null,
  customer_id uuid,
  token_hash text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_by_user_id text references "user"(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint website_review_invitations_status_check
    check (status in ('pending', 'used', 'revoked')),
  constraint website_review_invitations_booking_unique unique (workspace_id, booking_id)
);

create unique index review_invitations_id_workspace_unique_idx
  on website_review_invitations (id, workspace_id);

alter table website_reviews
  add column review_invitation_id uuid references website_review_invitations(id) on delete set null,
  add column booking_id uuid,
  add column customer_id uuid,
  add column is_verified boolean not null default false,
  add column verified_at timestamptz;
