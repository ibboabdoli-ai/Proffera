begin;

alter table company_directory_profiles
  drop constraint if exists company_directory_profiles_pilot_location_guard;

alter table company_directory_profiles
  add constraint company_directory_profiles_pilot_location_guard
  check (
    publication_status <> 'published'
    or lower(btrim(city)) in ('stockholm', 'södertälje')
    or lower(btrim(municipality)) in ('stockholm', 'södertälje')
  );

comment on constraint company_directory_profiles_pilot_location_guard
  on company_directory_profiles
  is 'Pilot guard: automatic/public directory rollout is limited to Stockholm and Södertälje until explicitly expanded.';

commit;
