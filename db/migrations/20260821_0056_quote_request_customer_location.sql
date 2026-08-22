-- Store exact customer location privately for marketplace matching.
-- These fields are intentionally not part of provider-facing Guest Quote projections.
-- Official address/reference verification is added through a separate bounded integration.
--
-- Rollout: apply and verify this additive migration before releasing any writer that
-- persists the private customer-location fields, and record the applied migration revision.
-- The CHECK is added NOT VALID so deployment does not scan historical quote rows; PostgreSQL
-- still enforces it for new/updated rows. Validate historical rows in a separate controlled
-- operation only after confirming they satisfy the location contract.
-- Production execution still needs the real migration path to set bounded lock_timeout and
-- statement_timeout values and to run in an approved deployment window: ADD COLUMN and
-- ADD CONSTRAINT acquire an ACCESS EXCLUSIVE lock even when the CHECK is NOT VALID.
-- Rollback: revert the writer first. Keep these nullable columns/constraint in place
-- until no deployed code references them; removing storage is a later deliberate migration.

alter table quote_requests
  add column if not exists customer_address_line1 text,
  add column if not exists customer_latitude double precision,
  add column if not exists customer_longitude double precision,
  add column if not exists customer_location_source text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quote_requests_customer_location_consistency_check'
      and conrelid = 'quote_requests'::regclass
  ) then
    alter table quote_requests
      add constraint quote_requests_customer_location_consistency_check
      check (coalesce((
        (
          customer_location_source is null
          and customer_address_line1 is null
          and customer_latitude is null
          and customer_longitude is null
        )
        or (
          customer_location_source = 'address'
          and nullif(btrim(customer_address_line1), '') is not null
          and customer_latitude is null
          and customer_longitude is null
        )
        or (
          customer_location_source = 'geolocation'
          and customer_address_line1 is null
          and customer_latitude is not null
          and customer_longitude is not null
          and customer_latitude between -90 and 90
          and customer_longitude between -180 and 180
        )
      ), false)) not valid;
  end if;
end
$$;

comment on column quote_requests.customer_address_line1 is
  'Private customer job address used for marketplace matching; not public/provider-facing before selection.';
comment on column quote_requests.customer_latitude is
  'Private customer latitude from explicit browser geolocation consent when location_source=geolocation.';
comment on column quote_requests.customer_longitude is
  'Private customer longitude from explicit browser geolocation consent when location_source=geolocation.';
comment on column quote_requests.customer_location_source is
  'Private location input method: address or geolocation.';
