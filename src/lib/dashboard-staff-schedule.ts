import "server-only";

import { neon } from "@neondatabase/serverless";

import { resolveDatabaseUrl } from "@/lib/db/database-url";

import { isValidLocalTime, localDateTimeToUtc, parseLocalDateTime, resolveBookingTimeZone } from "@/lib/public-booking-policy";
import { DEFAULT_WORKSPACE_MARKET } from "@/lib/workspace-market";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

const connectionString =
  resolveDatabaseUrl();

export type StaffScheduleRow = { id: string; staffId: string; staffName: string; weekday: number; startTime: string; endTime: string };
export type StaffTimeOffRow = { id: string; staffId: string; staffName: string; kind: string; reason: string; startsAt: string; endsAt: string };

async function requireManager() {
  if (!connectionString) throw new Error("Missing database connection");
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) throw new Error("Owner or admin access required");
  return access;
}

export async function getStaffPlanning() {
  const access = await requireManager();
  const sql = neon(connectionString!);
  try {
    const [schedules, timeOff, settings] = await Promise.all([
      sql`select ss.id, ss.staff_id, s.name as staff_name, ss.weekday, ss.start_time, ss.end_time from workspace_staff_schedules ss join workspace_staff s on s.id = ss.staff_id and s.workspace_id = ss.workspace_id where ss.workspace_id = ${access.workspaceId} and ss.is_active = true order by s.name, ss.weekday, ss.start_time`,
      sql`select t.id, t.staff_id, s.name as staff_name, t.kind, t.reason, t.starts_at, t.ends_at from workspace_staff_time_off t join workspace_staff s on s.id = t.staff_id and s.workspace_id = t.workspace_id where t.workspace_id = ${access.workspaceId} and t.ends_at >= now() order by t.starts_at asc limit 500`,
      sql`select time_zone from workspace_settings where workspace_id = ${access.workspaceId} limit 1`,
    ]);
    return {
      timeZone: resolveBookingTimeZone(settings[0]?.time_zone),
      schedules: schedules.map((row) => ({ id: String(row.id), staffId: String(row.staff_id), staffName: String(row.staff_name), weekday: Number(row.weekday), startTime: String(row.start_time).slice(0, 5), endTime: String(row.end_time).slice(0, 5) })),
      timeOff: timeOff.map((row) => ({ id: String(row.id), staffId: String(row.staff_id), staffName: String(row.staff_name), kind: String(row.kind), reason: String(row.reason ?? ""), startsAt: new Date(String(row.starts_at)).toISOString(), endsAt: new Date(String(row.ends_at)).toISOString() })),
    };
  } catch (error) {
    console.error("Failed to read staff planning", error);
    return { timeZone: DEFAULT_WORKSPACE_MARKET.timeZone, schedules: [] as StaffScheduleRow[], timeOff: [] as StaffTimeOffRow[] };
  }
}

export async function createStaffSchedule(input: { staffId: string; weekday: number; startTime: string; endTime: string }) {
  const access = await requireManager();
  if (!Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6 || !/^\d{2}:\d{2}$/.test(input.startTime) || !/^\d{2}:\d{2}$/.test(input.endTime) || input.endTime <= input.startTime) throw new Error("Invalid schedule");
  const sql = neon(connectionString!);
  const rows = await sql`insert into workspace_staff_schedules (workspace_id, staff_id, weekday, start_time, end_time) select ${access.workspaceId}, id, ${input.weekday}, ${input.startTime}::time, ${input.endTime}::time from workspace_staff where id = ${input.staffId} and workspace_id = ${access.workspaceId} and is_active = true on conflict do nothing returning id`;
  if (!rows[0]) throw new Error("Schedule could not be created");
}

export async function createStaffTimeOff(input: { staffId: string; kind: string; reason: string; startsAt: string; endsAt: string }) {
  const access = await requireManager();
  const sql = neon(connectionString!);
  const settings = await sql`select time_zone from workspace_settings where workspace_id = ${access.workspaceId} limit 1`;
  const timeZone = resolveBookingTimeZone(settings[0]?.time_zone);
  const startParts = parseLocalDateTime(input.startsAt);
  const endParts = parseLocalDateTime(input.endsAt);
  const start = startParts ? localDateTimeToUtc(startParts, timeZone) : new Date(Number.NaN);
  const end = endParts ? localDateTimeToUtc(endParts, timeZone) : new Date(Number.NaN);
  if (!startParts || !endParts || !isValidLocalTime(startParts, start, timeZone) || !isValidLocalTime(endParts, end, timeZone) || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start || !["leave", "sick", "break", "other"].includes(input.kind)) throw new Error("Invalid time off");
  const rows = await sql`insert into workspace_staff_time_off (workspace_id, staff_id, kind, reason, starts_at, ends_at) select ${access.workspaceId}, id, ${input.kind}, ${input.reason.trim().slice(0, 180)}, ${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz from workspace_staff where id = ${input.staffId} and workspace_id = ${access.workspaceId} and is_active = true returning id`;
  if (!rows[0]) throw new Error("Time off could not be created");
}

export async function deleteStaffPlanningEntry(type: "schedule" | "time_off", id: string) {
  const access = await requireManager(); const sql = neon(connectionString!);
  const rows = type === "schedule"
    ? await sql`delete from workspace_staff_schedules where id = ${id} and workspace_id = ${access.workspaceId} returning id`
    : await sql`delete from workspace_staff_time_off where id = ${id} and workspace_id = ${access.workspaceId} returning id`;
  if (!rows[0]) throw new Error("Planning entry not found");
}
