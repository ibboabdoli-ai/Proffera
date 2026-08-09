begin;

alter table company_directory_profiles
  add column if not exists claim_reserved_at timestamptz;

alter table company_directory_profiles
  drop constraint if exists company_directory_profiles_claim_reservation_pair_check;

alter table company_directory_profiles
  add constraint company_directory_profiles_claim_reservation_pair_check
  check (
    (claim_reservation_id is null and claim_reserved_at is null)
    or (claim_reservation_id is not null and claim_reserved_at is not null)
  );

create index if not exists company_directory_claim_reservation_lease_idx
  on company_directory_profiles (claim_reserved_at)
  where claim_reservation_id is not null;

commit;
