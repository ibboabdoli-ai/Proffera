-- P22E: Better Auth core schema migration candidate.
-- Status: reviewed in code only; do not apply to production until explicitly approved.
-- Scope: Better Auth identity/session tables only.
-- Non-goals: no workspace, membership, role, plan, CRM, booking, dashboard, or login behavior changes.

BEGIN;

CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique_idx"
  ON "user" ("email");

CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "token" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "session_token_unique_idx"
  ON "session" ("token");

CREATE INDEX IF NOT EXISTS "session_user_id_idx"
  ON "session" ("userId");

CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "accessToken" text,
  "refreshToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "idToken" text,
  "password" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "account_provider_account_unique_idx"
  ON "account" ("providerId", "accountId");

CREATE INDEX IF NOT EXISTS "account_user_id_idx"
  ON "account" ("userId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "verification_identifier_idx"
  ON "verification" ("identifier");

COMMIT;
