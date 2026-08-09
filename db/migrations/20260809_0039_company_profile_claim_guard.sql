begin;

create unique index if not exists company_directory_claims_one_active_per_user_idx
  on company_directory_claims (profile_id, claimant_user_id)
  where status in ('pending', 'verified');

commit;
