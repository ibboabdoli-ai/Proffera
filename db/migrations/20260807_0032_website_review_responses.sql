alter table website_reviews
  add column if not exists owner_reply text,
  add column if not exists owner_replied_at timestamptz,
  add column if not exists is_featured boolean not null default false;

create index if not exists website_reviews_public_featured_idx
  on website_reviews (workspace_id, is_featured desc, published_at desc)
  where status = 'approved' and is_verified = true;
