-- Establish a durable forward-looking ledger for Production schema changes.
--
-- Historical migrations are not retroactively claimed as applied. The only bootstrap
-- entry is 0065 because its canonical migration was independently applied and verified
-- against Production on 2026-08-23 before this ledger was introduced.
--
-- This migration is additive, idempotent, and atomic. If execution fails before COMMIT,
-- PostgreSQL rolls the entire migration back. Recovery is to fix the cause and rerun the
-- same canonical file; ON CONFLICT keeps the verified bootstrap rows idempotent.

begin;

create table if not exists proffera_schema_migrations (
  migration_key text primary key,
  filename text not null unique,
  checksum text,
  git_sha text,
  applied_at timestamptz not null default now(),
  applied_by text not null,
  execution_mode text not null,
  notes text
);

comment on table proffera_schema_migrations is
  'Forward-looking Production schema migration ledger. A row is evidence of an applied and verified migration, not merely a file merged to Git.';

insert into proffera_schema_migrations (
  migration_key,
  filename,
  checksum,
  git_sha,
  applied_by,
  execution_mode,
  notes
)
values
  (
    '20260823_0065',
    '20260823_0065_workspace_service_directory_identity.sql',
    null,
    null,
    'production-repair-20260823',
    'bootstrap-verified',
    'Canonical 0065 migration independently applied and schema-verified on Production after the Directory Search schema-drift incident.'
  ),
  (
    '20260823_0066',
    '20260823_0066_production_schema_ledger.sql',
    null,
    null,
    'migration-0066',
    'canonical-migration',
    'Introduces the forward-looking Production schema migration ledger.'
  )
on conflict (migration_key) do nothing;

commit;
