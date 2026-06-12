# Admin Setup

## Status

Phase 05 adds a temporary protected admin dashboard for reviewing quote requests.

## Required Vercel value

Add this value in Vercel Project Settings:

- ADMIN_ACCESS_CODE

Use a strong private value.

## How to open admin

Open:

- `/admin`

Enter the admin code.

## What admin can do now

- View recent quote requests
- Search by reference, city, category or customer
- Filter by status
- See request details and contact information

## Current limitations

- This is not full authentication.
- Status updates are not implemented yet.
- Admin logs are not implemented yet.
- Role-based login belongs to a later phase.
