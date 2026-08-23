-- Decouple Workspace public service URLs from the canonical Directory service taxonomy.
--
-- This migration is intentionally additive and backward compatible. Runtime readers
-- may continue to use `public_slug` during the rollout, while new/updated provider
-- activation can persist a durable primary Directory taxonomy identity separately.

begin;

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

create index if not exists workspace_services_primary_directory_service_idx
  on workspace_services (workspace_id, primary_directory_service_slug)
  where primary_directory_service_slug is not null;

comment on column workspace_services.primary_directory_service_slug is
  'Primary canonical Proffera Directory service taxonomy identity. Independent from public_slug, which remains the public URL/SEO slug. A future many-to-many mapping may extend this primary reference when a real use case requires it.';

commit;
