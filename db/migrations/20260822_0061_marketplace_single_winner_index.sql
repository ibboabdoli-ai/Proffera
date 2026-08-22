-- Final database guard: at most one selected Marketplace offer per Quote Request.
--
-- Sequencing: run only after migration 0060 has committed.
-- IMPORTANT: execute this file in autocommit mode. Do NOT wrap it in BEGIN/COMMIT
-- or in a migration-runner transaction because CREATE INDEX CONCURRENTLY cannot
-- run inside a transaction block.
--
-- The pre-check must return zero conflicting quote_request_id values. If it finds
-- any duplicates, this migration aborts; resolve them deliberately before retrying.
-- Rollback is deliberate and separate:
--   DROP INDEX CONCURRENTLY IF EXISTS marketplace_quote_offers_one_selected_per_quote_idx;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM marketplace_quote_offers
    WHERE status = 'selected'
    GROUP BY quote_request_id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'marketplace_quote_offers has multiple selected offers for one quote request';
  END IF;
END
$$;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS marketplace_quote_offers_one_selected_per_quote_idx
  ON marketplace_quote_offers (quote_request_id)
  WHERE status = 'selected';
