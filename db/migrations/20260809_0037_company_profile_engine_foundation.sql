-- Company Profile Engine foundation.
--
-- Keeps imported directory companies separate from customer workspaces until a
-- verified claim occurs. Every public field/media item carries source/rights
-- metadata and publication is fail-closed.

begin;

create table if not exists company_directory_profiles (
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
  constraint company_directory_profiles_org_kind_check check (organization_kind in ('juridical_person', 'sole_trader', 'unknown')),
  constraint company_directory_profiles_publication_check check (publication_status in ('imported', 'review', 'ready', 'published', 'blocked', 'claimed', 'inactive')),
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

create unique index if not exists company_directory_country_org_unique_idx
  on company_directory_profiles (country_code, organization_number);
create unique index if not exists company_directory_public_slug_unique_idx
  on company_directory_profiles (public_slug);
create index if not exists company_directory_public_search_idx
  on company_directory_profiles (publication_status, category_slug, city, quality_score desc);
create index if not exists company_directory_claimed_workspace_idx
  on company_directory_profiles (claimed_workspace_id) where claimed_workspace_id is not null;

create table if not exists company_directory_field_sources (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references company_directory_profiles(id) on delete cascade,
  field_name text not null,
  source_name text not null,
  source_record_id text not null default '',
  source_url text not null default '',
  value_hash text not null default '',
  confidence smallint not null default 100,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint company_directory_field_sources_confidence_check check (confidence between 0 and 100),
  constraint company_directory_field_sources_field_check check (char_length(field_name) between 1 and 80),
  constraint company_directory_field_sources_url_check check (char_length(source_url) <= 2000)
);

create index if not exists company_directory_field_sources_profile_idx
  on company_directory_field_sources (profile_id, field_name, observed_at desc);

create table if not exists company_directory_media (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references company_directory_profiles(id) on delete cascade,
  media_kind text not null,
  source_type text not null,
  source_url text not null default '',
  public_url text not null default '',
  attribution text not null default '',
  license_status text not null default 'unknown',
  rights_confirmed_at timestamptz,
  is_actual_business_media boolean not null default false,
  is_primary boolean not null default false,
  publication_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_directory_media_kind_check check (media_kind in ('logo', 'photo', 'category_illustration')),
  constraint company_directory_media_source_check check (source_type in ('owner_upload', 'licensed_partner', 'generated_category', 'external_reference')),
  constraint company_directory_media_license_check check (license_status in ('unknown', 'owner_confirmed', 'licensed', 'generated', 'rejected')),
  constraint company_directory_media_publication_check check (publication_status in ('pending', 'published', 'rejected')),
  constraint company_directory_media_rights_guard check (
    publication_status <> 'published' or license_status in ('owner_confirmed', 'licensed', 'generated')
  ),
  constraint company_directory_media_url_check check (char_length(source_url) <= 2000 and char_length(public_url) <= 2000)
);

create index if not exists company_directory_media_profile_idx
  on company_directory_media (profile_id, publication_status, is_primary desc, created_at desc);
create unique index if not exists company_directory_media_one_primary_idx
  on company_directory_media (profile_id) where is_primary = true and publication_status = 'published';

create table if not exists company_directory_sync_runs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null default 'running',
  cursor_value text not null default '',
  scanned_count integer not null default 0,
  upserted_count integer not null default 0,
  published_count integer not null default 0,
  blocked_count integer not null default 0,
  error_count integer not null default 0,
  error_summary text not null default '',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint company_directory_sync_runs_status_check check (status in ('running', 'completed', 'failed', 'cancelled'))
);

create unique index if not exists company_directory_one_running_sync_idx
  on company_directory_sync_runs (provider) where status = 'running';
create index if not exists company_directory_sync_runs_started_idx
  on company_directory_sync_runs (started_at desc);

create table if not exists company_directory_claims (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references company_directory_profiles(id) on delete cascade,
  claimant_user_id text not null,
  requested_workspace_id uuid references workspaces(id) on delete set null,
  status text not null default 'pending',
  verification_method text not null default 'manual_review',
  verification_reference text not null default '',
  requested_at timestamptz not null default now(),
  verified_at timestamptz,
  resolved_at timestamptz,
  constraint company_directory_claims_status_check check (status in ('pending', 'verified', 'rejected', 'claimed', 'cancelled')),
  constraint company_directory_claims_method_check check (verification_method in ('manual_review', 'email_domain', 'bolagsverket_signatory', 'bankid'))
);

create index if not exists company_directory_claims_profile_idx
  on company_directory_claims (profile_id, status, requested_at desc);

comment on table company_directory_profiles is 'Imported public-directory company records. Kept separate from tenant workspaces until a verified claim.';
comment on table company_directory_field_sources is 'Field-level provenance. Stores source metadata and a value hash, not a second raw copy of personal/source payloads.';
comment on table company_directory_media is 'Rights-aware profile media. Unknown-rights external media cannot be published.';
comment on table company_directory_sync_runs is 'Idempotent, observable ingestion runs for official company-data sources.';
comment on table company_directory_claims is 'Claim workflow foundation. A claim never creates tenant ownership until verification succeeds.';

commit;
