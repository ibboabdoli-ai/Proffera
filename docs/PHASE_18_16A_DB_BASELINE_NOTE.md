# Phase 18.16A implementation note

This branch adds the read-only baseline for workspace services:

- workspace_services table migration
- default service seed migration
- read-only database helper
- read-only dashboard component
- settings page connection for the Tjänster section

No service create/edit/delete action is included in this branch.

The database migrations still need to be executed in Neon after merge, in this order:

1. db/migrations/20260614_phase18_16_workspace_services.sql
2. db/migrations/20260614_phase18_16_workspace_services_seed.sql

Manual verification after migration:

- Open /dashboard/installningar
- Confirm Tjänster shows services from workspace_services
- Confirm company profile save still works
