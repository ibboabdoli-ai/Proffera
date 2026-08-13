begin;

alter table company_directory_discovery_queue
  add column if not exists primary_sni_code text not null default '';

comment on column company_directory_discovery_queue.primary_sni_code is
  'Official SCB Ng1 captured during bulk discovery and preserved through detail verification.';

commit;
