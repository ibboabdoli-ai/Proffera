create table if not exists website_gallery_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  media_type text not null,
  public_url text not null,
  storage_key text not null,
  title text,
  caption text,
  alt_text text not null,
  display_style text not null default 'grid',
  status text not null default 'draft',
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  mime_type text not null,
  bytes bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint website_gallery_media_type_check check (media_type in ('image','video')),
  constraint website_gallery_display_style_check check (display_style in ('grid','masonry','slider','hero','video')),
  constraint website_gallery_status_check check (status in ('draft','published','hidden'))
);
create index if not exists website_gallery_workspace_status_sort_idx on website_gallery_items(workspace_id,status,sort_order,created_at desc);