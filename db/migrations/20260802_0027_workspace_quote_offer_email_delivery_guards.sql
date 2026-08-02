-- Completes the quote-offer email-delivery guards after the base delivery schema.
-- No raw customer-link token is introduced or persisted by this migration.

alter table workspace_quote_offer_email_deliveries
  drop constraint if exists workspace_quote_offer_email_deliveries_failure_code_check;

alter table workspace_quote_offer_email_deliveries
  add constraint workspace_quote_offer_email_deliveries_failure_code_check
  check (failure_code is null or failure_code in ('configuration', 'provider', 'network', 'rendering', 'superseded'));

create unique index if not exists workspace_quote_offer_email_deliveries_one_pending_unique
  on workspace_quote_offer_email_deliveries (workspace_id, quote_offer_id)
  where status = 'pending';
