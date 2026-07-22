-- Public form safety: durable rate limits and recorded consent for demo requests.
BEGIN;

CREATE TABLE IF NOT EXISTS public_submission_rate_limits (
  scope text NOT NULL,
  fingerprint text NOT NULL,
  window_started_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 1 CHECK (attempts >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, fingerprint)
);

CREATE INDEX IF NOT EXISTS public_submission_rate_limits_updated_at_idx
  ON public_submission_rate_limits (updated_at);

ALTER TABLE company_registrations
  ADD COLUMN IF NOT EXISTS consent_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_version text,
  ADD COLUMN IF NOT EXISTS consent_recorded_at timestamptz;

COMMIT;
