"use server";

import { redirect } from "next/navigation";

import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { bookingWeekdays } from "@/lib/workspace-booking-hours-db";
import { getSql } from "@/lib/db/server";

type BookingHoursError = "access" | "hours" | "save";

function redirectWithError(error: BookingHoursError): never {
  redirect(`/dashboard/installningar?hours_error=${error}`);
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function isTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function toMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export async function updateWorkspaceBookingHoursAction(formData: FormData) {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) redirectWithError("access");

  const hours = bookingWeekdays.map(({ value }) => {
    const isClosed = formData.get(`closed_${value}`) === "on";
    const opensAt = text(formData, `opens_at_${value}`);
    const closesAt = text(formData, `closes_at_${value}`);
    if (!isClosed && (!isTime(opensAt) || !isTime(closesAt) || toMinutes(opensAt) >= toMinutes(closesAt))) {
      redirectWithError("hours");
    }
    return { weekday: value, isClosed, opensAt: isClosed ? null : opensAt, closesAt: isClosed ? null : closesAt };
  });

  const sql = getSql();
  if (!sql) redirectWithError("save");

  try {
    for (const hour of hours) {
      await sql`
        insert into workspace_booking_hours (workspace_id, weekday, opens_at, closes_at, is_closed)
        values (${access.workspaceId}, ${hour.weekday}, ${hour.opensAt}::time, ${hour.closesAt}::time, ${hour.isClosed})
        on conflict (workspace_id, weekday) do update set
          opens_at = excluded.opens_at,
          closes_at = excluded.closes_at,
          is_closed = excluded.is_closed,
          updated_at = now()
      `;
    }
  } catch (error) {
    console.error("Failed to save workspace booking hours", error);
    redirectWithError("save");
  }

  redirect("/dashboard/installningar?hours_updated=1");
}
