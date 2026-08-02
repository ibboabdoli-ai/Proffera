-- Additive service-pricing storage for E2.
--
-- Currency is intentionally not duplicated on workspace_services. The active
-- workspace billing currency remains the authority. Existing base_price_sek
-- data is preserved as legacy storage and is not backfilled because its
-- semantics cannot be inferred safely for international workspaces.

begin;

alter table workspace_services
  add column if not exists price_type text,
  add column if not exists price_amount_minor bigint;

-- Recreate named constraints deterministically so this migration is safe to
-- retry without procedural DO blocks that some migration runners split badly.
alter table workspace_services
  drop constraint if exists workspace_services_price_type_check;

alter table workspace_services
  add constraint workspace_services_price_type_check
  check (price_type is null or price_type in ('fixed', 'from', 'quote'))
  not valid;

alter table workspace_services
  validate constraint workspace_services_price_type_check;

alter table workspace_services
  drop constraint if exists workspace_services_price_shape_check;

alter table workspace_services
  add constraint workspace_services_price_shape_check
  check (
    (price_type is null and price_amount_minor is null)
    or (price_type = 'quote' and price_amount_minor is null)
    or (price_type in ('fixed', 'from') and price_amount_minor is not null and price_amount_minor >= 0)
  )
  not valid;

alter table workspace_services
  validate constraint workspace_services_price_shape_check;

comment on column workspace_services.price_type is
  'Currency-safe service price mode: fixed, from, or quote. Null means legacy pricing has not been migrated.';

comment on column workspace_services.price_amount_minor is
  'Service amount in the workspace billing currency minor unit. Null for quote or unmigrated legacy pricing.';

commit;
