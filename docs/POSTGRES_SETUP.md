# PostgreSQL Setup

## Status

Phase 04 uses a PostgreSQL database for quote request persistence.

Recommended provider:

- Neon PostgreSQL

## Required Vercel value

Add this value in Vercel Project Settings:

- DATABASE_URL

Use the pooled connection string from your PostgreSQL provider when available.

## Database setup

Run this migration in your PostgreSQL SQL editor:

- `database/migrations/001_create_quote_requests.sql`

The migration creates:

- `quote_requests`
- status constraint
- basic indexes

## Manual verification

1. Add DATABASE_URL in Vercel.
2. Run the migration in the database SQL editor.
3. Open `/fa-offert`.
4. Fill the form with valid data.
5. Submit the form.
6. Confirm that a row appears in `quote_requests`.
7. Confirm that the form shows a reference number.

## Current limitation

Admin read access is not implemented yet. That belongs to the admin phase.
