-- Per-workspace B2B market settings for Sweden, the EU and the UK.
-- Existing workspaces stay Sweden-first unless explicitly changed in Settings.

begin;

alter table workspace_settings
  add column if not exists billing_country_code text not null default 'SE',
  add column if not exists time_zone text not null default 'Europe/Stockholm',
  add column if not exists billing_currency text not null default 'SEK',
  add column if not exists vat_number text not null default '';

-- Older workspaces may predate the settings record. Create a settings row for
-- each active/trial workspace so the market fields are always per-workspace.
insert into workspace_settings (workspace_id, company_name)
select workspace.id::text, workspace.name
from workspaces workspace
where workspace.status in ('active', 'trial')
on conflict (workspace_id) do nothing;

-- Normalize any partially-applied or manually-entered values before the
-- constraints below are added. This migration never changes business data.
update workspace_settings
set billing_country_code = 'SE'
where billing_country_code is null
   or billing_country_code not in (
     'SE',
     'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
     'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
     'SI', 'ES',
     'GB'
   );

update workspace_settings
set time_zone = case billing_country_code
  when 'AT' then 'Europe/Vienna'
  when 'BE' then 'Europe/Brussels'
  when 'BG' then 'Europe/Sofia'
  when 'HR' then 'Europe/Zagreb'
  when 'CY' then 'Europe/Nicosia'
  when 'CZ' then 'Europe/Prague'
  when 'DK' then 'Europe/Copenhagen'
  when 'EE' then 'Europe/Tallinn'
  when 'FI' then 'Europe/Helsinki'
  when 'FR' then 'Europe/Paris'
  when 'DE' then 'Europe/Berlin'
  when 'GR' then 'Europe/Athens'
  when 'HU' then 'Europe/Budapest'
  when 'IE' then 'Europe/Dublin'
  when 'IT' then 'Europe/Rome'
  when 'LV' then 'Europe/Riga'
  when 'LT' then 'Europe/Vilnius'
  when 'LU' then 'Europe/Luxembourg'
  when 'MT' then 'Europe/Malta'
  when 'NL' then 'Europe/Amsterdam'
  when 'PL' then 'Europe/Warsaw'
  when 'PT' then 'Europe/Lisbon'
  when 'RO' then 'Europe/Bucharest'
  when 'SK' then 'Europe/Bratislava'
  when 'SI' then 'Europe/Ljubljana'
  when 'ES' then 'Europe/Madrid'
  when 'GB' then 'Europe/London'
  else 'Europe/Stockholm'
end
where time_zone is null
   or time_zone not in (
     'Europe/Amsterdam', 'Europe/Athens', 'Europe/Belgrade', 'Europe/Berlin',
     'Europe/Bratislava', 'Europe/Brussels', 'Europe/Bucharest',
     'Europe/Budapest', 'Europe/Copenhagen', 'Europe/Dublin',
     'Europe/Helsinki', 'Europe/Lisbon', 'Europe/Ljubljana', 'Europe/London',
     'Europe/Luxembourg', 'Europe/Madrid', 'Europe/Malta', 'Europe/Nicosia',
     'Europe/Paris', 'Europe/Prague', 'Europe/Riga', 'Europe/Rome',
     'Europe/Sofia', 'Europe/Stockholm', 'Europe/Tallinn', 'Europe/Vienna',
     'Europe/Vilnius', 'Europe/Warsaw', 'Europe/Zagreb'
   );

update workspace_settings
set billing_currency = case when billing_country_code = 'SE' then 'SEK'
                            when billing_country_code = 'GB' then 'GBP'
                            else 'EUR' end
where billing_currency is null
   or (billing_country_code = 'SE' and billing_currency <> 'SEK')
   or (billing_country_code = 'GB' and billing_currency <> 'GBP')
   or (billing_country_code not in ('SE', 'GB') and billing_currency <> 'EUR');

update workspace_settings
set vat_number = upper(regexp_replace(vat_number, '[[:space:]]+', '', 'g'))
where vat_number is null
   or vat_number <> upper(regexp_replace(vat_number, '[[:space:]]+', '', 'g'));

-- PrimeView is the existing UK workspace. It has no booking records, so the
-- market switch cannot reinterpret an existing appointment.
update workspace_settings settings
set billing_country_code = 'GB',
    time_zone = 'Europe/London',
    billing_currency = 'GBP',
    updated_at = now()
from workspaces workspace
where settings.workspace_id = workspace.id::text
  and workspace.slug = 'primeview-window-care';

-- This migration runs inside one transaction. If it is interrupted, all
-- changes roll back together rather than leaving a partial schema behind.
alter table workspace_settings add constraint workspace_settings_billing_country_code_check check (
  billing_country_code in (
    'SE',
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
    'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
    'SI', 'ES',
    'GB'
  )
);

alter table workspace_settings add constraint workspace_settings_time_zone_check check (
  time_zone in (
    'Europe/Amsterdam', 'Europe/Athens', 'Europe/Belgrade', 'Europe/Berlin',
    'Europe/Bratislava', 'Europe/Brussels', 'Europe/Bucharest',
    'Europe/Budapest', 'Europe/Copenhagen', 'Europe/Dublin',
    'Europe/Helsinki', 'Europe/Lisbon', 'Europe/Ljubljana', 'Europe/London',
    'Europe/Luxembourg', 'Europe/Madrid', 'Europe/Malta', 'Europe/Nicosia',
    'Europe/Paris', 'Europe/Prague', 'Europe/Riga', 'Europe/Rome',
    'Europe/Sofia', 'Europe/Stockholm', 'Europe/Tallinn', 'Europe/Vienna',
    'Europe/Vilnius', 'Europe/Warsaw', 'Europe/Zagreb'
  )
);

alter table workspace_settings add constraint workspace_settings_billing_currency_check check (
  (billing_country_code = 'SE' and billing_currency = 'SEK')
  or (billing_country_code = 'GB' and billing_currency = 'GBP')
  or (billing_country_code not in ('SE', 'GB') and billing_currency = 'EUR')
);

alter table workspace_settings add constraint workspace_settings_vat_number_check check (
  char_length(vat_number) <= 32
  and vat_number ~ '^[A-Z0-9-]*$'
);

comment on column workspace_settings.billing_country_code is
  'B2B billing market: Sweden, EU country, or United Kingdom.';
comment on column workspace_settings.time_zone is
  'IANA business time zone used to interpret booking and staff schedule inputs.';
comment on column workspace_settings.billing_currency is
  'B2B billing currency preference. Stripe Checkout remains the authority for the payable amount and currency.';

commit;
