create or replace function enforce_public_booking_service_policy()
returns trigger
language plpgsql
as $$
declare
  selected_service workspace_services%rowtype;
  conflicting_booking_id bookings.id%type;
  schedule_changed boolean;
  reactivating_booking boolean;
begin
  if new.source is distinct from 'public_booking' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    schedule_changed := true;
    reactivating_booking := false;
  else
    schedule_changed :=
      new.workspace_id is distinct from old.workspace_id
      or new.service is distinct from old.service
      or new.starts_at is distinct from old.starts_at
      or new.ends_at is distinct from old.ends_at
      or new.source is distinct from old.source;

    reactivating_booking :=
      old.status in ('cancelled', 'no_show')
      and new.status not in ('cancelled', 'no_show');
  end if;

  -- Cancelling a booking must remain possible even after its start time or
  -- after the service has been deactivated.
  if new.status in ('cancelled', 'no_show') then
    return new;
  end if;

  -- Status-only changes such as requested -> confirmed -> completed must not
  -- reapply notice or advance rules to an existing booking.
  if not schedule_changed and not reactivating_booking then
    return new;
  end if;

  select *
  into selected_service
  from workspace_services
  where workspace_id = new.workspace_id
    and name = new.service
  limit 1;

  if not found or (schedule_changed and not selected_service.is_active) then
    raise exception using
      errcode = '23514',
      message = 'public_booking_service_unavailable';
  end if;

  if new.starts_at is null or new.ends_at is null or new.ends_at <= new.starts_at then
    raise exception using
      errcode = '23514',
      message = 'public_booking_invalid_interval';
  end if;

  if schedule_changed then
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
