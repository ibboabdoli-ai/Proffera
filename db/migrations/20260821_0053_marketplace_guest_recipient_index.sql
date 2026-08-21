-- Non-transactional index migration for marketplace guest recipient lookups.
--
-- IMPORTANT: apply this file WITHOUT a wrapping transaction. CREATE INDEX
-- CONCURRENTLY and DROP INDEX CONCURRENTLY are intentionally used so invitation
-- dispatch, suppression, and opt-out traffic can continue while the replacement
-- index is built. Create the replacement first, verify that PostgreSQL considers
-- it valid, and only then remove the old index. A failed/retried concurrent build
-- therefore leaves the old index in place as the safe fallback.
--
-- Production forward order: 0049 -> 0050 -> 0051 -> 0052 -> 0053 -> 0054 -> 0055,
-- then deploy the application. Committing this file does not apply it to Production.

create index concurrently if not exists marketplace_quote_invitations_recipient_norm_idx
  on marketplace_quote_invitations (lower(btrim(recipient_email)), status, created_at desc);

-- Fail before dropping the fallback index if CREATE INDEX CONCURRENTLY left an
-- invalid index behind. The successful branch casts '1'. The failure branch
-- deliberately raises an invalid-text-representation error with a named marker.
select (
  case
    when exists (
      select 1
      from pg_index
      join pg_class on pg_class.oid = pg_index.indexrelid
      where pg_class.relname = 'marketplace_quote_invitations_recipient_norm_idx'
        and pg_index.indisvalid
    ) then '1'
    else 'marketplace_recipient_norm_index_invalid'
  end
)::integer;

drop index concurrently if exists marketplace_quote_invitations_recipient_idx;