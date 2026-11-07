-- Preview-only Maria card description translations (English and Arabic).
-- Swedish remains the canonical workspace_services.short_description text.
-- Additive schema only; no existing customer, booking, price or service row is modified.
-- Apply in an isolated Preview database only after separate migration approval.
-- Production rollout, if ever authorized, must verify schema/ledger and retain
-- Maria's existing booking activation and owner-access restrictions.
-- Rollback: revert dependent application code first; preserve translations
-- before dropping this table. Do not auto-drop or down-migrate.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE IF NOT EXISTS maria_service_card_translations (
  service_id uuid NOT NULL REFERENCES workspace_services(id) ON DELETE CASCADE,
  locale text NOT NULL CHECK (locale IN ('en', 'ar')),
  description text NOT NULL DEFAULT ''
    CHECK (char_length(description) <= 280),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT maria_service_card_translations_pk PRIMARY KEY (service_id, locale)
);

INSERT INTO proffera_schema_migrations (
  migration_key, filename, checksum, git_sha, applied_by, execution_mode, notes
) VALUES (
  '20261107_0074',
  '20261107_0074_maria_card_translations.sql',
  null, null, 'migration-0074', 'canonical-migration',
  'Adds Preview-only English and Arabic descriptions for Maria bridal service cards; no data backfill or Production activation.'
)
ON CONFLICT (migration_key) DO NOTHING;

COMMIT;
