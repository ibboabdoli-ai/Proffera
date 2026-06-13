# Phase 18.11 — Create booking form verification

Status: accepted with limitation
Date: 2026-06-13

## Scope

Phase 18.11 implemented a controlled create-booking flow for the Proffera dashboard.

Included scope:

- Add `/dashboard/bokningar/ny`.
- Allow creating a booking for an existing CRM customer.
- Insert only into the `bookings` table.
- Use `source = 'dashboard_manual'` for manually created dashboard bookings.
- Require an internal write access code.
- Validate title, customer, status, city, start/end time, service taxonomy and notes.
- Redirect to the booking profile after successful creation.

Explicitly excluded scope:

- No customer creation.
- No booking edit flow.
- No booking delete flow.
- No status update implementation in this phase.
- No email/Brevo send.
- No lead matching, lead outbox, quote request or admin workflow changes.
- No customer event should be created by the create-booking action.

## Implementation commits

- `214e1c9a62a36de4676aeb4231b1c59a560009c4` — added booking creation helpers in `src/lib/dashboard-db.ts`.
- `6d55c6a766eeee0997ee09988f764ce54bfd8b36` — added `Ny bokning` entry point in `/dashboard/bokningar`.
- `930f30188bb370e27e8cf735bd59b2e76d5c91a5` — added `/dashboard/bokningar/ny` form.
- `4ca9a23cbd58d7b5514064289479e9865d9b784d` — fixed TypeScript narrowing in `/dashboard/kunder/ny` so production build succeeds.

## Build verification

The first production build failed because TypeScript flagged `resolvedService` as possibly `null` in `src/app/dashboard/kunder/ny/page.tsx`.

Resolution:

```ts
const resolvedService = resolveServiceSelection(serviceSelection);
const validatedService = resolvedService ?? redirectWithError("service");
```

Vercel status for commit `4ca9a23cbd58d7b5514064289479e9865d9b784d`: `success`.

The middleware/proxy warning is non-blocking and did not fail the build.

## Manual verification performed

### Create form rendering

The user verified that `/dashboard/bokningar/ny` rendered the expected fields:

- Internal access code.
- Customer selector.
- Title.
- Status.
- City.
- Start time.
- End time.
- Service.
- Notes.
- Safety boundary text.
- Submit button.

### Manual booking creation

The user created a manual test booking.

Observed result in `/dashboard/bokningar`:

- `Bokningar i CRM`: increased to `2`.
- `Bekräftade`: stayed `1`.
- `Förfrågade`: increased to `1`.
- A new row appeared for `Test booking`.
- Customer shown: `Demo Kund – Sara Andersson`.
- City shown: `Södertälje`.
- Service shown: `Hemstädning`.
- Status shown: `Förfrågad`.

This verifies that the create-booking form inserted a booking row and that the booking list read it back from Neon.

### Cleanup / back-to-baseline

After cleanup, the user verified `/dashboard/bokningar` again.

Observed result:

- `Bokningar i CRM`: `1`.
- `Bekräftade`: `1`.
- `Förfrågade`: `0`.
- `Klara`: `0`.
- Only the original `Demo booking – Hemstädning` remained.

This verifies that the manual test booking was removed and the dashboard returned to the clean demo baseline.

## Limitation / not verified

The manual test booking detail profile was not verified before cleanup.

The user opened the existing seeded demo booking profile instead:

- Title: `Demo booking – Hemstädning`.
- Source: `demo_seed`.
- Status: `Bekräftad`.
- Events: `1`.

Therefore, the following specific check remains unverified for the manual booking:

- Opening `/dashboard/bokningar/[id]` for the manually created `Test booking`.
- Confirming source `dashboard_manual` on the detail page.
- Confirming no customer history event was created for the manual booking.

Accepted decision:

- The phase is accepted based on successful form rendering, list-level creation verification, Vercel production build success, and cleanup/back-to-baseline verification.
- The manual booking detail-profile verification is explicitly documented as not performed.

## Final assessment

Phase 18.11 is accepted with the limitation above.

Safe to continue to the next planned phase after this report is committed.
