create table if not exists company_directory_scb_enrichment (
  profile_id uuid primary key references company_directory_profiles(id) on delete cascade,
  organization_number text not null,
  observed_company_name text not null default '',
  phone text not null default '',
  email text not null default '',
  postal_address jsonb not null default '{}'::jsonb,
  municipality text not null default '',
  sni_codes jsonb not null default '[]'::jsonb,
  workplaces jsonb not null default '[]'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  conflicts jsonb not null default '[]'::jsonb,
  source_payload_hash text not null default '',
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_directory_scb_enrichment_org_number_check
    check (organization_number ~ '^[0-9]{10}$')
);

create index if not exists company_directory_scb_enrichment_org_idx
  on company_directory_scb_enrichment (organization_number);

create index if not exists company_directory_scb_enrichment_last_synced_idx
  on company_directory_scb_enrichment (last_synced_at);
