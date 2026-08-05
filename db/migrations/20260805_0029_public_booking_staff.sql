alter table public_booking_verifications
  add column if not exists staff_id uuid references workspace_staff(id) on delete set null;

create index if not exists public_booking_verifications_workspace_staff_slot_idx
  on public_booking_verifications (workspace_id, staff_id, starts_at, ends_at)
  where consumed_at is null;

comment on column public_booking_verifications.staff_id is
  'Staff member selected for the held public booking slot.';
