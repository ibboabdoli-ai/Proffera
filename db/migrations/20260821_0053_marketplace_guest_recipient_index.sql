-- Non-transactional index migration for marketplace guest recipient lookups.
--
-- IMPORTANT: apply this file WITHOUT a wrapping transaction. CREATE INDEX
-- CONCURRENTLY and DROP INDEX CONCURRENTLY are intentionally used so invitation
-- dispatch, suppression, and opt-out traffic can continue while the replacement
-- index is built. Create the replacement first, then remove the old index so
-- there is no window without recipient lookup coverage.
--
-- Production forward order: 0049 -> 0050 -> 0051 -> 0052 -> 0053, then deploy
-- the application. Committing this file does not apply it to Production.

create index concurrently if not exists marketplace_quote_invitations_recipient_norm_idx
  on marketplace_quote_invitations (lower(btrim(recipient_email)), status, created_at desc);

drop index concurrently if exists marketplace_quote_invitations_recipient_idx;
