begin;

create unique index if not exists company_directory_field_sources_value_unique_idx
  on company_directory_field_sources (profile_id, field_name, source_name, value_hash);

commit;
