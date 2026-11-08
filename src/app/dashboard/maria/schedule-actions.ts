"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db/server";
import { getMariaBookingReadiness } from "@/lib/maria-booking-runtime";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

/** Parse a 30-minute-aligned schedule clock or return null for invalid input. */
function minutes(value: FormDataEntryValue | null) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const h=Number(match[1]),m=Number(match[2]);
  return h<=23 && m<=59 && m%30===0 ? h*60+m : null;
}
/** Format a number of minutes after midnight as HH:mm. */
function clock(n: number) {
  return `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;
}

/**
 * Save Maria's duration, buffer and Fri-Sun opening hours after manager
 * authorization; Production additionally requires verified booking readiness.
 * Serialize the edit against in-flight bookings in both deployments.
 */
export async function saveMariaScheduleAction(formData: FormData) {
  const access = await getUserWorkspaceAccess();
  const preview = process.env.VERCEL_ENV === "preview";
  const production = process.env.VERCEL_ENV === "production";
  if ((!preview && !production) || !access.ok || access.workspaceSlug !== "makeup-by-maria"
    || !canManageWorkspaceSettings(access)) redirect("/dashboard");
  if (production) {
    const readiness = await getMariaBookingReadiness();
    if (!readiness.enabled || readiness.workspaceId !== access.workspaceId) redirect("/dashboard");
  }

  const duration=Number(formData.get("duration_minutes"));
  const buffer=Number(formData.get("buffer_after_minutes"));
  const previousDuration=formData.get("original_duration_minutes");
  const previousBuffer=formData.get("original_buffer_after_minutes");
  const serviceChanged=previousDuration===null||previousBuffer===null
    ||duration!==Number(previousDuration)||buffer!==Number(previousBuffer);
  if (!Number.isInteger(duration)||duration<30||duration>720||duration%30!==0
    || !Number.isInteger(buffer)||buffer<0||buffer>120||buffer%15!==0) {
    redirect("/dashboard/maria?error=schedule");
  }
  const days=[5,6,0].map(day=>({
    day,closed:formData.get(`day_${day}_closed`)==="on",
    first:minutes(formData.get(`day_${day}_first`)),
    last:minutes(formData.get(`day_${day}_last`)),
  }));
  if(days.some(d=>!d.closed && (d.first===null||d.last===null||d.last<=d.first
    ||d.last+duration+buffer>1439))) redirect("/dashboard/maria?error=schedule");
  const proposedHours = JSON.stringify(days.map(d => ({
    weekday:d.day, is_closed:d.closed, first_minute:d.first, last_minute:d.last,
  })));
  const sql=getSql();
  if (!sql) redirect("/dashboard/maria?error=database");
  try {
    await sql.transaction([
      // The appointment-time edit must not race an in-flight confirmation.
      sql`select pg_advisory_xact_lock(hashtextextended(${access.workspaceId}::text, 713))`,
      // Give the actual locked transaction an unambiguous failure marker.
      // CAST is applied to the runtime CASE result, not a constant branch.
      // This preserves the original reason even if an OTP hold expires later.
      sql`
        select (case
          when not exists (
            select 1 from workspace_services s
            join workspaces w on w.id::text=s.workspace_id
            where w.id=${access.workspaceId}::uuid and w.slug='makeup-by-maria'
              and w.status in ('active','trial')
              and s.public_slug ~ '^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$'
          ) then 'MARIA_SCHEDULE_NO_SERVICE'
          when ${serviceChanged}::boolean and exists (
            select 1 from public_booking_verifications hold
            where hold.workspace_id=${access.workspaceId}::uuid
              and hold.consumed_at is null and hold.expires_at>now()
          ) then 'MARIA_SCHEDULE_HOLD_CONFLICT'
          when exists (
            select 1 from workspace_services s
            cross join jsonb_to_recordset(${proposedHours}::jsonb)
              as d(weekday integer,is_closed boolean,first_minute integer,last_minute integer)
            where s.workspace_id=${access.workspaceId}
              and s.public_slug ~ '^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$'
              and d.is_closed=false
              and (
                coalesce((case when ${serviceChanged}::boolean then ${duration}
                  else s.duration_minutes end),-1) < 1
                or coalesce((case when ${serviceChanged}::boolean then ${buffer}
                  else s.buffer_after_minutes end),-1) < 0
                or d.last_minute
                  + (case when ${serviceChanged}::boolean then ${duration} else s.duration_minutes end)
                  + (case when ${serviceChanged}::boolean then ${buffer} else s.buffer_after_minutes end)
                  > 1439
              )
          ) then 'MARIA_SCHEDULE_DURATION_CONFLICT'
          when exists (
            select 1 from public_booking_verifications hold
            where hold.workspace_id=${access.workspaceId}::uuid
              and hold.consumed_at is null and hold.expires_at>now()
              and not exists (
                select 1 from jsonb_to_recordset(${proposedHours}::jsonb)
                  as d(weekday integer,is_closed boolean,first_minute integer,last_minute integer)
                where d.is_closed=false
                  and d.weekday=extract(dow from
                    (hold.starts_at at time zone 'Europe/Stockholm'))::int
                  and (extract(hour from (hold.starts_at at time zone 'Europe/Stockholm'))*60
                    +extract(minute from (hold.starts_at at time zone 'Europe/Stockholm')))
                    between d.first_minute and d.last_minute
              )
          ) then 'MARIA_SCHEDULE_HOLD_CONFLICT'
          else '1'
        end)::integer as maria_package_guard
      `,
      ...days.map(d=>sql`
        insert into workspace_booking_hours
          (workspace_id,weekday,opens_at,closes_at,is_closed)
        select w.id::text,${d.day},${d.closed ? null : clock(d.first!)}::time,
          ${d.closed ? null : clock(d.last!)}::time,${d.closed}
        from workspaces w
        where w.id=${access.workspaceId}::uuid and w.slug='makeup-by-maria'
        on conflict (workspace_id,weekday)
        do update set opens_at=excluded.opens_at,closes_at=excluded.closes_at,is_closed=excluded.is_closed
      `),
      ...(serviceChanged ? [sql`
        update workspace_services s
        set duration_minutes=${duration},buffer_after_minutes=${buffer},updated_at=now()
        from workspaces w
        where w.id=${access.workspaceId}::uuid and w.slug='makeup-by-maria'
        and s.workspace_id=w.id::text
        and s.public_slug ~ '^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$'
      `] : []),
      sql`
        insert into admin_audit_logs(admin_user_id,workspace_id,action,reason,new_value)
        values(${access.userId},${access.workspaceId}::uuid,
          'maria.booking_schedule.updated',
          'Workspace manager changed Maria appointment start windows, service duration and buffer',
          ${JSON.stringify({durationMinutes:duration,bufferAfterMinutes:buffer,serviceChanged,
            days:days.map(d=>({weekday:d.day,closed:d.closed,firstMinute:d.first,lastStartMinute:d.last}))})}::jsonb)
      `,
    ]);
  } catch(error) {
    console.error("Maria booking schedule could not be updated",error);
    // The guard writes its reason into the PostgreSQL error in the locked
    // transaction. Never diagnose a different database snapshot after rollback.
    const failure = error instanceof Error ? error.message : String(error);
    const reason = failure.includes("MARIA_SCHEDULE_HOLD_CONFLICT")
      ? "schedule_hold"
      : failure.includes("MARIA_SCHEDULE_DURATION_CONFLICT")
        ? "schedule_duration"
        : "schedule";
    redirect(`/dashboard/maria?error=${reason}`);
  }
  revalidatePath("/dashboard/maria");
  revalidatePath("/api/makeup-by-maria/config");
  redirect("/dashboard/maria?updated=schedule#tider");
}

            and d.is_closed=false
            and d.last_minute
              +(case when ${serviceChanged}::boolean then ${duration} else s.duration_minutes end)
              +(case when ${serviceChanged}::boolean then ${buffer} else s.buffer_after_minutes end)>1439
          limit 1
        `;
        if (durationConflicts.length) cause = "schedule_duration";
      } catch (diagnosticError) { console.error("Maria duration conflict diagnosis failed", diagnosticError); }
    }
    redirect(`/dashboard/maria?error=${cause}`);
  }
  revalidatePath("/dashboard/maria");
  revalidatePath("/api/makeup-by-maria/config");
  redirect("/dashboard/maria?updated=schedule#tider");
}
