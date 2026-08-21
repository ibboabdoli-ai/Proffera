-- Validate the widened marketplace invitation status constraint only after 0051
-- has committed, so the table lock used to replace the constraint is not held for
-- the validation scan. Production forward order is:
-- 0049 -> 0050 -> 0051 -> 0052 -> 0053 -> 0054 -> application deploy.
-- Committing this file does not apply it to Production.

alter table marketplace_quote_invitations
  validate constraint marketplace_quote_invitations_status_check;