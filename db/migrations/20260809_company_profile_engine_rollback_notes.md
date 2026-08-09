# Company Profile Engine rollback notes

Scope: migrations `20260809_0037_company_profile_engine_foundation.sql` through `20260809_0040_company_profile_claim_reservation.sql`.

These migrations are additive. Do not run the rollback in Production without first confirming that no claimed Workspace depends on `company_directory_profiles.claimed_workspace_id` for operational traceability.

Recommended rollback order on an isolated branch:

```sql
begin;

drop index if exists company_directory_claim_reservation_unique_idx;
alter table if exists company_directory_profiles
  drop constraint if exists company_directory_profiles_claim_reservation_id_fkey;
alter table if exists company_directory_profiles
  drop column if exists claim_reservation_id;

drop index if exists company_directory_claims_one_active_per_user_idx;
drop index if exists company_directory_field_sources_value_unique_idx;

drop table if exists company_directory_claims;
drop table if exists company_directory_sync_runs;
drop table if exists company_directory_media;
drop table if exists company_directory_field_sources;
drop table if exists company_directory_profiles;

commit;
```

Before rollback, export at minimum:

- claimed directory profile ID → Workspace ID mappings;
- active claim reservation → claim ID mappings;
- claim decisions and verification references;
- field provenance hashes/source identifiers;
- media rights/attribution records;
- sync-run diagnostics.

Application rollback:

1. Disable the Company Profile Engine cron in `vercel.json` or in Vercel Cron Jobs.
2. Keep `COMPANY_DIRECTORY_AUTO_PUBLISH=false` while rolling back.
3. Remove public `/foretag/listad/*` discovery links before dropping the tables.
4. Revert the application commit/PR.
5. Only then drop the additive tables on the target database branch.

The rollback does not delete Workspaces already provisioned from an approved claim. Those Workspaces are regular Proffera tenants and require a separate, explicit business-data decision.
