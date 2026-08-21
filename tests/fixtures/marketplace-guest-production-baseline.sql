-- Isolated production-schema baseline for marketplace guest PostgreSQL tests.
--
-- This fixture deliberately does NOT replay db/legacy-migrations. It mirrors the
-- production shapes required by the marketplace migrations from the maintained
-- schema sources:
--   workspaces                  -> db/migrations/20260616_0002_proffera_workspace_schema.sql
--   company_directory_profiles -> db/migrations/20260809_0037_company_profile_engine_foundation.sql
--   quote_requests              -> current production table shape retained from
--                                  the historical bootstrap definition
-- Keep this fixture in sync when any of those production tables change fields or
-- constraints used by the marketplace guest graph.

create extension if not exists pgcrypto;

create table workspaces (
  id uuid primary key,
  slug text not null,
  name text not null,
  company_name text,
  primary_city text,
  contact_email text,
  contact_phone text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workspaces_status_check
    check (status in ('active', 'trial', 'paused', 'cancelled'))
);

create unique index workspaces_slug_unique_idx on workspaces (slug);

create table quote_requests (
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
      'draft', 'submitted', 'pending_review', 'approved', 'matched', 'answered',
      'booked', 'completed', 'cancelled', 'rejected'
    )
  )
);

create index quote_requests_status_idx on quote_requests (status);
create index quote_requests_city_idx on quote_requests (city);
create index quote_requests_category_idx on quote_requests (category);
create index quote_requests_created_at_idx on quote_requests (created_at desc);

create table company_directory_profiles (
  id uuid primary key default gen_random_uuid(),
  country_code text not null default 'SE',
  organization_number text not null,
  organization_kind text not null default 'unknown',
  legal_name text not null,
  display_name text not null,
  legal_form text not null default '',
  organization_status text not null default '',
  is_active boolean not null default false,
  f_tax_status text not null default '',
  vat_status text not null default '',
  employer_status text not null default '',
  primary_sni_code text not null default '',
  primary_sni_label text not null default '',
  category_slug text not null default '',
  service_slugs text[] not null default '{}',
  activity_description text not null default '',
  address_line1 text not null default '',
  postal_code text not null default '',
  city text not null default '',
  municipality text not null default '',
  region text not null default '',
  website_url text not null default '',
  public_slug text not null,
  publication_status text not null default 'imported',
  quality_score smallint not null default 0,
  quality_reasons jsonb not null default '[]'::jsonb,
  privacy_blocked boolean not null default false,
  auto_public_eligible boolean not null default false,
  claimed_workspace_id uuid references workspaces(id) on delete set null,
  official_source text not null default '',
  source_record_id text not null default '',
  source_updated_at timestamptz,
  last_synced_at timestamptz not null default now(),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_directory_profiles_country_check check (country_code ~ '^[A-Z]{2}$'),
  constraint company_directory_profiles_org_kind_check
    check (organization_kind in ('juridical_person', 'sole_trader', 'unknown')),
  constraint company_directory_profiles_publication_check
    check (publication_status in ('imported', 'review', 'ready', 'published', 'blocked', 'claimed', 'inactive')),
  constraint company_directory_profiles_quality_check check (quality_score between 0 and 100),
  constraint company_directory_profiles_slug_check check (public_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint company_directory_profiles_public_guard check (
    publication_status <> 'published' or (
      is_active = true
      and auto_public_eligible = true
      and privacy_blocked = false
      and organization_kind = 'juridical_person'
      and quality_score >= 80
      and legal_name <> ''
      and city <> ''
      and category_slug <> ''
    )
  )
);

create unique index company_directory_country_org_unique_idx
  on company_directory_profiles (country_code, organization_number);
create unique index company_directory_public_slug_unique_idx
  on company_directory_profiles (public_slug);
create index company_directory_public_search_idx
  on company_directory_profiles (publication_status, category_slug, city, quality_score desc);
create index company_directory_claimed_workspace_idx
  on company_directory_profiles (claimed_workspace_id) where claimed_workspace_id is not null;

-- Executable contract for the base table that is not recreated by the active
-- migration chain. Marketplace migrations depend on these columns and on the
-- exact open/closed status vocabulary; fail clearly if this fixture drifts.
do $$
declare
  missing_columns text[];
  status_definition text;
begin
  select array_agg(required.column_name order by required.column_name)
    into missing_columns
    from (values ('id'), ('status'), ('consent_accepted')) as required(column_name)
   where not exists (
     select 1
       from information_schema.columns column_info
      where column_info.table_schema = 'public'
        and column_info.table_name = 'quote_requests'
        and column_info.column_name = required.column_name
   );

  if coalesce(array_length(missing_columns, 1), 0) > 0 then
    raise exception using
      errcode = '23514',
      message = 'marketplace_guest_quote_requests_schema_missing:' || array_to_string(missing_columns, ',');
  end if;

  select pg_get_constraintdef(constraint_info.oid)
    into status_definition
    from pg_constraint constraint_info
   where constraint_info.conrelid = 'quote_requests'::regclass
     and constraint_info.conname = 'quote_requests_status_check';

  if status_definition is null
     or position('submitted' in status_definition) = 0
     or position('pending_review' in status_definition) = 0
     or position('approved' in status_definition) = 0
     or position('matched' in status_definition) = 0
     or position('answered' in status_definition) = 0
     or position('booked' in status_definition) = 0
     or position('completed' in status_definition) = 0
     or position('cancelled' in status_definition) = 0
     or position('rejected' in status_definition) = 0 then
    raise exception using
      errcode = '23514',
      message = 'marketplace_guest_quote_requests_status_contract_invalid';
  end if;
end;
$$;