-- Decouple Workspace public service URLs from the canonical Directory service taxonomy.
--
-- This migration is intentionally additive and backward compatible. Runtime readers
-- may continue to use `public_slug` during the rollout, while new/updated provider
-- activation can persist a durable primary Directory taxonomy identity separately.
--
-- IMPORTANT: execute this file in autocommit mode. Do NOT wrap it in BEGIN/COMMIT
-- or in a migration-runner transaction because CREATE INDEX CONCURRENTLY cannot
-- run inside a transaction block. The DDL/backfill statements are idempotent so a
-- partially interrupted deployment can safely be retried before the concurrent
-- index phase completes.
--
-- Deployment sequence:
--   1. Add/validate the nullable FK and exact-only backfill below.
--   2. Build workspace_services_primary_directory_service_idx concurrently.
--   3. Apply the column comment.
-- Rollback is deliberate and separate:
--   DROP INDEX CONCURRENTLY IF EXISTS workspace_services_primary_directory_service_idx;
--   ALTER TABLE workspace_services DROP CONSTRAINT IF EXISTS workspace_services_primary_directory_service_fk;
--   ALTER TABLE workspace_services DROP COLUMN IF EXISTS primary_directory_service_slug;

alter table workspace_services
  add column if not exists primary_directory_service_slug text;

alter table workspace_services
  drop constraint if exists workspace_services_primary_directory_service_fk;

alter table workspace_services
  add constraint workspace_services_primary_directory_service_fk
  foreign key (primary_directory_service_slug)
  references company_directory_services(slug)
  on delete restrict
  not valid;

alter table workspace_services
  validate constraint workspace_services_primary_directory_service_fk;

-- Backfill only exact, already-proven legacy mappings. Do not infer from names,
-- categories or fuzzy similarity: an arbitrary public URL slug is not taxonomy proof.
update workspace_services service
set primary_directory_service_slug = directory_service.slug,
    updated_at = now()
from company_directory_services directory_service
where service.primary_directory_service_slug is null
  and service.public_slug is not null
  and service.public_slug = directory_service.slug;

create index concurrently if not exists workspace_services_primary_directory_service_idx
  on workspace_services (workspace_id, primary_directory_service_slug)
  where primary_directory_service_slug is not null;

comment on column workspace_services.primary_directory_service_slug is
  'Primary canonical Proffera Directory service taxonomy identity. Independent from public_slug, which remains the public URL/SEO slug. A future many-to-many mapping may extend this primary reference when a real use case requires it.';
