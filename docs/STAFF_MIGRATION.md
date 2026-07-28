# Workspace staff migration

Apply `db/migrations/20260728_0016_workspace_staff.sql` to the Proffera Neon database before using `/dashboard/personal`.

The migration is additive:

- creates `workspace_staff`
- adds nullable `bookings.staff_id`
- adds workspace/time indexes
- does not modify existing booking rows

After applying, verify the Iboren test workspace only. Do not test against juliussalong.
