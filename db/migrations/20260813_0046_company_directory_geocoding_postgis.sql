-- Company Directory geocoding support.
--
-- PostGIS is used only to transform official Lantmäteriet SWEREF 99 TM
-- coordinates (EPSG:3006) into latitude/longitude (EPSG:4326) before storing
-- them in company_directory_business_locations.

begin;

create extension if not exists postgis;

commit;
