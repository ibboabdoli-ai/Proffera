-- Store Lantmäteriet-verified customer coordinates separately from browser geolocation.
-- Exact address, verified coordinates and the official reference remain private matching data.
--
-- Rollout: this migration is additive and must be verified on isolated Preview before Production.
-- Application code is backward-compatible while these columns are absent: matching falls back to
-- the existing customer coordinates/locality path and persistence stores the legacy location shape.
-- Once the columns exist, exact-address requests can persist verified WGS84 coordinates/reference.
-- The CHECK is NOT VALID to avoid a historical-row scan while still enforcing new/updated rows.
-- ADD COLUMN / ADD CONSTRAINT still require a brief ACCESS EXCLUSIVE lock, so Production execution
-- needs the controlled migration path with bounded lock_timeout/statement_timeout.
-- Rollback: roll application code back first. Keep the nullable columns and constraint in place;
-- historical verified coordinates/references are private provenance and are not rewritten by rollback.

alter table quote_requests
  add column if not exists customer_verified_latitude double precision,
  add column if not exists customer_verified_longitude double precision,
  add column if not exists customer_location_verification_source text,
  add column if not exists customer_location_verification_reference text,
  add column if not exists customer_location_verified_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'quote_requests_verified_address_consistency_check'
      and conrelid = 'quote_requests'::regclass
  ) then
    alter table quote_requests
      add constraint quote_requests_verified_address_consistency_check
      check (coalesce((
        (
          customer_verified_latitude is null
          and customer_verified_longitude is null
          and customer_location_verification_source is null
          and customer_location_verification_reference is null
          and customer_location_verified_at is null
        )
        or (
          customer_location_source = 'address'
          and nullif(btrim(customer_address_line1), '') is not null
          and customer_verified_latitude is not null
          and customer_verified_longitude is not null
          and customer_verified_latitude between -90 and 90
          and customer_verified_longitude between -180 and 180
          and customer_location_verification_source = 'lantmateriet_belagenhetsadress_v4_2'
          and customer_location_verification_reference ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and customer_location_verified_at is not null
        )
      ), false)) not valid;
  end if;
end
$$;

comment on column quote_requests.customer_verified_latitude is
  'Private WGS84 latitude derived server-side from a verified Lantmäteriet address; not provider-facing before selection.';
comment on column quote_requests.customer_verified_longitude is
  'Private WGS84 longitude derived server-side from a verified Lantmäteriet address; not provider-facing before selection.';
comment on column quote_requests.customer_location_verification_source is
  'Private official address verification source identifier.';
comment on column quote_requests.customer_location_verification_reference is
  'Private official Lantmäteriet address object reference; not provider-facing before selection.';
comment on column quote_requests.customer_location_verified_at is
  'Timestamp when the exact customer address was verified against the official address source.';
