begin;

alter table company_directory_profiles
  add column if not exists claim_reservation_id uuid;

alter table company_directory_profiles
  drop constraint if exists company_directory_profiles_claim_reservation_id_fkey;

alter table company_directory_profiles
  add constraint company_directory_profiles_claim_reservation_id_fkey
  foreign key (claim_reservation_id)
  references company_directory_claims(id)
  on delete set null;

create unique index if not exists company_directory_claim_reservation_unique_idx
  on company_directory_profiles (claim_reservation_id)
  where claim_reservation_id is not null;

commit;
