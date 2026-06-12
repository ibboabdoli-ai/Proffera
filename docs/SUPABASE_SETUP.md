# Supabase Setup

## Status

Phase 04 adds the first database table and connects the quote request form to a Supabase persistence layer.

## Required Vercel project values

Add these values in Vercel Project Settings for Preview and Production:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

Use the values from the Supabase project Connect dialog.

## Database setup

Run this migration in Supabase SQL Editor:

- `database/migrations/001_create_quote_requests.sql`

The migration creates:

- `public.quote_requests`
- status constraint
- basic indexes
- row level security
- insert policy for submitted requests with consent

## Manual verification

1. Add the required Vercel project values.
2. Run the migration in Supabase SQL Editor.
3. Open `/fa-offert`.
4. Fill the form with valid data.
5. Submit the form.
6. Confirm that a row appears in `quote_requests`.
7. Confirm that the form shows a reference number.

## Current limitation

Admin read access is not implemented yet. That belongs to the admin phase.
