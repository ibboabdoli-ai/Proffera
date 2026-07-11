-- Reset all current dashboard test data before real customer use.
-- Approved scope: customers, bookings, and customer activity only.
-- Does not change users, workspace memberships, workspace settings, services, or authentication.

BEGIN;

DELETE FROM customer_events;
DELETE FROM bookings;
DELETE FROM customers;

COMMIT;
