"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSql } from "@/lib/db/server";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

function minutes(value: FormDataEntryValue | null) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const h=Number(match[1]),m=Number(match[2]);
  return h<=23 && m<=59 && m%30===0 ? h*60+m : null;
}
function clock(n: number) {
  return `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;
}

export async function saveMariaScheduleAction(formData: FormData) {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || access.workspaceSlug !== "makeup-by-maria"
    || !canManageWorkspaceSettings(access)) redirect("/dashboard");

  const duration=Number(formData.get("duration_minutes"));
  const buffer=Number(formData.get("buffer_after_minutes"));
  if (!Number.isInteger(duration)||duration<30||duration>720||duration%30!==0
    || !Number.isInteger(buffer)||buffer<0||buffer>120||buffer%15!==0) {
    redirect("/dashboard/maria?error=schedule");
  }
  const days=[5,6].map(day=>({
    day,closed:formData.get(`day_${day}_closed`)==="on",
    first:minutes(formData.get(`day_${day}_first`)),
    last:minutes(formData.get(`day_${day}_last`)),
  }));
  if(days.some(d=>d.first===null||d.last===null||d.last<=d.first
    ||d.last+duration+buffer>1439)) redirect("/dashboard/maria?error=schedule");
  const sql=getSql();
  if (!sql) redirect("/dashboard/maria?error=database");
  try {
    await sql.transaction([
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
      sql`
        update workspace_services s
        set duration_minutes=${duration},buffer_after_minutes=${buffer},updated_at=now()
        from workspaces w
        where w.id=${access.workspaceId}::uuid and w.slug='makeup-by-maria'
        and s.workspace_id=w.id::text
        and s.public_slug ~ '^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$'
      `,
      sql`
        insert into admin_audit_logs(admin_user_id,workspace_id,action,reason,new_value)
        values(${access.userId},${access.workspaceId}::uuid,
          'maria.booking_schedule.updated',
          'Workspace manager changed Maria appointment start windows, service duration and buffer',
          ${JSON.stringify({durationMinutes:duration,bufferAfterMinutes:buffer,
            days:days.map(d=>({weekday:d.day,closed:d.closed,firstMinute:d.first,lastStartMinute:d.last}))})}::jsonb)
      `,
    ]);
  } catch(error) {
    console.error("Maria booking schedule could not be updated",error);
    redirect("/dashboard/maria?error=schedule");
  }
  revalidatePath("/dashboard/maria");
  redirect("/dashboard/maria?updated=schedule");
}
