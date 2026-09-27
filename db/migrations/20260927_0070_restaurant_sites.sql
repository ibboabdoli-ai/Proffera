-- A site is provisioned for a verified owner workspace by an operator.
-- No public slug can be claimed from the dashboard.
-- Validate this canonical migration on an isolated Neon Preview branch before Production execution.
-- Merging this file is not evidence that the Production schema has been migrated.

begin;

create table restaurant_sites (
  id uuid primary key default gen_random_uuid(),
  -- Workspace-owned content: deleting the Workspace intentionally cascades its site snapshots.
  -- Preserve/export this row before deleting a Workspace; rollback must not delete the Workspace.
  workspace_id uuid not null unique references workspaces(id) on delete cascade,
  public_slug text not null unique,
  draft jsonb not null default '{}'::jsonb,
  published jsonb,
  draft_revision integer not null default 0,
  published_revision integer,
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  constraint restaurant_site_slug_check check (public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint restaurant_site_draft_object_check check (jsonb_typeof(draft) = 'object'),
  constraint restaurant_site_published_object_check check (published is null or jsonb_typeof(published) = 'object')
);

create index if not exists restaurant_sites_public_slug_idx
  on restaurant_sites(public_slug)
  where published is not null;

insert into proffera_schema_migrations (
  migration_key,
  filename,
  checksum,
  git_sha,
  applied_by,
  execution_mode,
  notes
)
values (
  '20260927_0070',
  '20260927_0070_restaurant_sites.sql',
  null,
  null,
  'migration-0070',
  'canonical-migration',
  'Adds operator-provisioned restaurant-site draft/published snapshots scoped one-to-one to an existing Workspace. No public slug can be claimed from the dashboard and no customer content is seeded.'
)
on conflict (migration_key) do nothing;

do $migration$
begin
  if not exists (
    select 1
    from proffera_schema_migrations
    where migration_key = '20260927_0070'
      and filename = '20260927_0070_restaurant_sites.sql'
  ) then
    raise exception 'Migration key 20260927_0070 is registered with a different filename';
  end if;
end
$migration$;

commit;
