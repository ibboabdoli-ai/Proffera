create or replace function enforce_public_booking_service_policy()
returns trigger
language plpgsql
as $$
declare
  selected_service workspace_services%rowtype;
  conflicting_booking_id bookings.id%type;
begin
  if new.source is distinct from 'public_booking' then
    return new;
  end if;

  select *
  into selected_service
  from workspace_services
  where workspace_id = new.workspace_id
    and name = new.service
    and is_active = true
  limit 1;

  if not found then
    raise exception using
      errcode = '23514',
      message = 'public_booking_service_unavailable';
  end if;

  if new.starts_at < now() + make_interval(mins => selected_service.minimum_notice_minutes) then
    raise exception using
      errcode = '23514',
      message = 'public_booking_minimum_notice';
  end if;

  if new.starts_at > now() + make_interval(days => selected_service.maximum_advance_days) then
    raise exception using
      errcode = '23514',
      message = 'public_booking_maximum_advance';
  end if;

  select existing.id
  into conflicting_booking_id
  from bookings existing
  left join workspace_services existing_service
    on existing_service.workspace_id = existing.workspace_id
   and existing_service.name = existing.service
  where existing.workspace_id = new.workspace_id
    and existing.status not in ('cancelled', 'no_show')
    and existing.id is distinct from new.id
    and existing.starts_at - make_interval(mins => coalesce(existing_service.buffer_before_minutes, 0))
      < new.ends_at + make_interval(mins => selected_service.buffer_after_minutes)
    and existing.ends_at + make_interval(mins => coalesce(existing_service.buffer_after_minutes, 0))
      > new.starts_at - make_interval(mins => selected_service.buffer_before_minutes)
  limit 1;

  if conflicting_booking_id is not null then
    raise exception using
      errcode = '23P01',
      message = 'public_booking_buffer_conflict';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_public_policy_enforcement on bookings;

create trigger bookings_public_policy_enforcement
before insert or update of workspace_id, service, starts_at, ends_at, status, source
on bookings
for each row
execute function enforce_public_booking_service_policy();
