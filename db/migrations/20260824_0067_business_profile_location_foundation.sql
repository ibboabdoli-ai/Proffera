-- Business Profile location semantics foundation.
--
-- This table is deliberately additive and is not a replacement for
-- company_directory_business_locations yet. The existing single Directory
-- location remains the matching/geocoding source until a later controlled
-- migration moves consumers to this multi-location model.
--
-- Privacy defaults are fail-closed: a new location starts private and
-- non-visitable. Exact public/map eligibility requires an explicitly public,
-- confirmed, visitable workplace/storefront/service base. Registered/postal
-- addresses therefore cannot become map points merely because official data
-- contains a street address.

begin;

create table if not exists company_directory_profile_locations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references company_directory_profiles(id) on delete cascade,
  owner_workspace_id uuid references workspaces(id) on delete cascade,
  purpose text not null,
  visibility text not null default 'private',
  is_visitable boolean not null default false,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  source_type text not null,
  address_line1 text not null default '',
  postal_code text not null default '',
  city text not null default '',
  municipality text not null default '',
  latitude numeric(9,6),
  longitude numeric(9,6),
  geocode_source text not null default '',
  geocode_precision text not null default 'unknown',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_directory_profile_locations_purpose_check
    check (purpose in ('registered', 'postal', 'workplace', 'storefront', 'service_base')),
  constraint company_directory_profile_locations_visibility_check
    check (visibility in ('private', 'approximate', 'public')),
  constraint company_directory_profile_locations_source_check
    check (source_type in ('official', 'scb', 'owner', 'admin')),
  constraint company_directory_profile_locations_owner_source_check
    check (source_type <> 'owner' or owner_workspace_id is not null),
  constraint company_directory_profile_locations_coordinate_pair_check
    check ((latitude is null) = (longitude is null)),
  constraint company_directory_profile_locations_latitude_check
    check (latitude is null or latitude between -90 and 90),
  constraint company_directory_profile_locations_longitude_check
    check (longitude is null or longitude between -180 and 180),
  constraint company_directory_profile_locations_precision_check
    check (geocode_precision in ('unknown', 'postal_code', 'street', 'address', 'rooftop')),
  constraint company_directory_profile_locations_visitable_purpose_check
    check (not is_visitable or purpose in ('workplace', 'storefront', 'service_base')),
  constraint company_directory_profile_locations_public_exact_check
    check (
      visibility <> 'public'
      or (
        is_visitable
        and confirmed_at is not null
        and purpose in ('workplace', 'storefront', 'service_base')
      )
    )
);

create index if not exists company_directory_profile_locations_profile_idx
  on company_directory_profile_locations (profile_id, is_active, purpose, is_primary desc);

create index if not exists company_directory_profile_locations_owner_idx
  on company_directory_profile_locations (owner_workspace_id, profile_id)
  where owner_workspace_id is not null and is_active = true;

create unique index if not exists company_directory_profile_locations_primary_idx
  on company_directory_profile_locations (profile_id)
  where is_primary = true and is_active = true;

create index if not exists company_directory_profile_locations_public_map_idx
  on company_directory_profile_locations (profile_id, purpose, latitude, longitude)
  where
    is_active = true
    and visibility = 'public'
    and is_visitable = true
    and confirmed_at is not null
    and latitude is not null
    and longitude is not null;

comment on table company_directory_profile_locations is
  'Multi-location Business Profile foundation. Exact public/map disclosure is opt-in and requires purpose, visibility, visitability and confirmation semantics.';
comment on column company_directory_profile_locations.owner_workspace_id is
  'Owner provenance only. Any owner write must still resolve the current claimed Workspace from company_directory_profiles server-side; client Workspace ids are never authority.';
comment on column company_directory_profile_locations.visibility is
  'Public projection intent. private exposes nothing; approximate exposes locality only; public exact output is additionally gated by purpose, visitability and confirmation.';

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
  '20260824_0067',
  '20260824_0067_business_profile_location_foundation.sql',
  null,
  null,
  'migration-0067',
  'canonical-migration',
  'Adds the fail-closed multi-location Business Profile location model. No legacy location rows are backfilled and no public coordinates are activated by this migration.'
)
on conflict (migration_key) do nothing;

commit;
