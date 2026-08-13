-- Company Directory service + location search foundation.
--
-- Adds a normalized service taxonomy and geo-ready location/service-area models
-- without changing publication behavior. Existing `service_slugs` remain as a
-- backwards-compatible cache while search migrates to relational data.

begin;

create table if not exists company_directory_service_categories (
  slug text primary key,
  label text not null,
  search_aliases text[] not null default '{}',
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_directory_service_categories_slug_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

create table if not exists company_directory_services (
  slug text primary key,
  category_slug text not null references company_directory_service_categories(slug) on delete restrict,
  parent_service_slug text references company_directory_services(slug) on delete restrict,
  label text not null,
  search_aliases text[] not null default '{}',
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_directory_services_slug_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint company_directory_services_parent_check
    check (parent_service_slug is null or parent_service_slug <> slug)
);

create index if not exists company_directory_services_category_idx
  on company_directory_services (category_slug, is_active, sort_order, label);
create index if not exists company_directory_services_aliases_idx
  on company_directory_services using gin (search_aliases);

create table if not exists company_directory_profile_services (
  profile_id uuid not null references company_directory_profiles(id) on delete cascade,
  service_slug text not null references company_directory_services(slug) on delete restrict,
  source_type text not null default 'sni',
  confidence smallint not null default 80,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  public_visible boolean not null default true,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (profile_id, service_slug),
  constraint company_directory_profile_services_source_check
    check (source_type in ('sni', 'website', 'admin', 'owner')),
  constraint company_directory_profile_services_confidence_check
    check (confidence between 0 and 100)
);

create index if not exists company_directory_profile_services_search_idx
  on company_directory_profile_services (service_slug, profile_id)
  where is_active = true and public_visible = true;
create index if not exists company_directory_profile_services_profile_idx
  on company_directory_profile_services (profile_id, is_active, is_primary desc);

create table if not exists company_directory_business_locations (
  profile_id uuid primary key references company_directory_profiles(id) on delete cascade,
  latitude numeric(9,6),
  longitude numeric(9,6),
  geocode_source text not null default '',
  geocode_precision text not null default 'unknown',
  geocode_confidence smallint not null default 0,
  is_public boolean not null default true,
  geocoded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_directory_business_locations_latitude_check
    check (latitude is null or latitude between -90 and 90),
  constraint company_directory_business_locations_longitude_check
    check (longitude is null or longitude between -180 and 180),
  constraint company_directory_business_locations_coordinate_pair_check
    check ((latitude is null) = (longitude is null)),
  constraint company_directory_business_locations_precision_check
    check (geocode_precision in ('unknown', 'postal_code', 'street', 'address', 'rooftop')),
  constraint company_directory_business_locations_confidence_check
    check (geocode_confidence between 0 and 100)
);

create index if not exists company_directory_business_locations_geo_idx
  on company_directory_business_locations (latitude, longitude)
  where latitude is not null and longitude is not null;

create table if not exists company_directory_service_areas (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references company_directory_profiles(id) on delete cascade,
  service_slug text references company_directory_services(slug) on delete cascade,
  radius_km numeric(6,2) not null,
  source_type text not null default 'owner',
  confidence smallint not null default 100,
  public_visible boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_directory_service_areas_radius_check
    check (radius_km > 0 and radius_km <= 300),
  constraint company_directory_service_areas_source_check
    check (source_type in ('website', 'admin', 'owner')),
  constraint company_directory_service_areas_confidence_check
    check (confidence between 0 and 100)
);

create unique index if not exists company_directory_service_areas_default_unique_idx
  on company_directory_service_areas (profile_id)
  where service_slug is null;
create unique index if not exists company_directory_service_areas_service_unique_idx
  on company_directory_service_areas (profile_id, service_slug)
  where service_slug is not null;
create index if not exists company_directory_service_areas_public_idx
  on company_directory_service_areas (profile_id, service_slug, radius_km)
  where public_visible = true;

insert into company_directory_service_categories (slug, label, search_aliases, sort_order)
values
  ('vvs', 'VVS', array['rörmokare', 'rormokare', 'rör', 'ror'], 10),
  ('elektriker', 'Elektriker', array['el', 'elservice', 'elinstallatör', 'elinstallator'], 20),
  ('stadning', 'Städning', array['städ', 'stad', 'städfirma', 'stadfirma', 'lokalvård', 'lokalvard'], 30),
  ('maleri', 'Måleri', array['målare', 'malare', 'målning', 'malning'], 40),
  ('snickeri', 'Snickeri', array['snickare', 'byggnadssnickeri'], 50),
  ('flytt', 'Flytt', array['flyttfirma', 'flytthjälp', 'flytthjalp'], 60),
  ('tradgard', 'Trädgård', array['trädgård', 'tradgard', 'trädgårdshjälp', 'tradgardshjalp'], 70),
  ('hemservice', 'Hemservice', array['hushållsnära tjänster', 'hushallsnara tjanster'], 80)
on conflict (slug) do update set
  label = excluded.label,
  search_aliases = excluded.search_aliases,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

insert into company_directory_services (
  slug, category_slug, parent_service_slug, label, search_aliases, sort_order
)
values
  ('vvs', 'vvs', null, 'VVS / Rörmokare', array['vvs', 'rörmokare', 'rormokare', 'rör', 'ror'], 10),
  ('avloppsrensning', 'vvs', 'vvs', 'Avloppsrensning', array['avlopp', 'stopp i avlopp', 'avloppsservice'], 20),
  ('vattenlacka', 'vvs', 'vvs', 'Vattenläcka', array['vattenläcka', 'vattenlacka', 'läckage', 'lackage'], 30),
  ('varmepump', 'vvs', 'vvs', 'Värmepump', array['värmepump', 'varmepump'], 40),

  ('elinstallation', 'elektriker', null, 'Elinstallation', array['elektriker', 'el', 'elservice', 'elinstallation'], 10),
  ('felsokning-el', 'elektriker', 'elinstallation', 'Felsökning el', array['elfel', 'felsökning el', 'felsokning el'], 20),
  ('laddbox', 'elektriker', 'elinstallation', 'Laddbox', array['elbilsladdare', 'laddbox installation'], 30),
  ('elcentral', 'elektriker', 'elinstallation', 'Elcentral', array['säkringsskåp', 'sakringsskap', 'centralbyte'], 40),

  ('hemstadning', 'stadning', null, 'Hemstädning', array['hemstäd', 'hemstad', 'städning hemma', 'stadning hemma'], 10),
  ('kontorsstadning', 'stadning', null, 'Kontorsstädning', array['kontorsstäd', 'kontorsstad', 'lokalvård', 'lokalvard'], 20),
  ('flyttstadning', 'stadning', null, 'Flyttstädning', array['flyttstäd', 'flyttstad'], 30),
  ('fonsterputsning', 'stadning', null, 'Fönsterputsning', array['fönsterputs', 'fonsterputs', 'fönstertvätt', 'fonstertvatt'], 40),

  ('malning', 'maleri', null, 'Målning', array['målare', 'malare', 'måleri', 'maleri'], 10),
  ('snickeri', 'snickeri', null, 'Snickeri', array['snickare', 'byggnadssnickeri'], 10),
  ('flytthjalp', 'flytt', null, 'Flytthjälp', array['flyttfirma', 'flytthjälp', 'flytthjalp'], 10),
  ('tradgardshjalp', 'tradgard', null, 'Trädgårdshjälp', array['trädgård', 'tradgard', 'trädgårdshjälp', 'tradgardshjalp'], 10)
on conflict (slug) do update set
  category_slug = excluded.category_slug,
  parent_service_slug = excluded.parent_service_slug,
  label = excluded.label,
  search_aliases = excluded.search_aliases,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

-- Preserve current official SNI-derived service assignments as relational rows.
-- We deliberately do not infer fine-grained child services such as water leaks,
-- drain clearing or EV chargers from a broad SNI code.
insert into company_directory_profile_services (
  profile_id, service_slug, source_type, confidence, is_primary, is_active, public_visible
)
select
  profile.id,
  service_slug,
  'sni',
  80,
  row_number() over (partition by profile.id order by service_slug) = 1,
  true,
  true
from company_directory_profiles profile
cross join lateral unnest(profile.service_slugs) service_slug
join company_directory_services service on service.slug = service_slug
on conflict (profile_id, service_slug) do nothing;

comment on table company_directory_service_categories is
  'Stable customer-facing service categories used by directory search, SEO and matching.';
comment on table company_directory_services is
  'Normalized Proffera service taxonomy. Fine-grained services are not automatically inferred from broad SNI classifications.';
comment on table company_directory_profile_services is
  'Canonical searchable company-to-service relation with source and confidence metadata.';
comment on table company_directory_business_locations is
  'Geo-ready business location for nearby search. Coordinates remain null until a geocoding source resolves them.';
comment on table company_directory_service_areas is
  'Optional company coverage radius. Public visibility is false by default so Proffera never invents a company service area.';

commit;
