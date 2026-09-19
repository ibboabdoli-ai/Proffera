import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarRange, UsersRound } from "lucide-react";

import { DashboardLocaleBoundary } from "@/components/dashboard/dashboard-locale-boundary";
import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getDashboardStaff } from "@/lib/dashboard-staff";
import { assignStaffToBooking, getStaffBookingAssignments } from "@/lib/dashboard-staff-bookings";
import { getDashboardWorkspaceSettings } from "@/lib/workspace-settings-db";

export const dynamic = "force-dynamic";

function localizedHref(href: string, isEnglish: boolean) {
  return isEnglish ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href;
}

function formatWorkspaceTime(value: string, isEnglish: boolean, timeZone: string) {
  return new Intl.DateTimeFormat(isEnglish ? "en-GB" : "sv-SE", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function assignStaffAction(formData: FormData) {
  "use server";
  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const staffId = String(formData.get("staff_id") ?? "").trim();
  const isEnglish = String(formData.get("lang") ?? "") === "en";
  try {
    await assignStaffToBooking(bookingId, staffId);
  } catch (error) {
    console.error("Failed to assign staff to booking", error);
    redirect(localizedHref("/dashboard/personal/bokningar?error=conflict", isEnglish));
  }
  redirect(localizedHref("/dashboard/personal/bokningar?updated=1", isEnglish));
}

export default async function StaffBookingAssignmentPage({ searchParams }: { searchParams?: Promise<{ updated?: string; error?: string; lang?: string | string[] }> }) {
  const [staff, bookings, workspaceSettings, query] = await Promise.all([getDashboardStaff(), getStaffBookingAssignments(), getDashboardWorkspaceSettings(), searchParams ?? Promise.resolve(undefined)]);
  const lang = Array.isArray(query?.lang) ? query.lang[0] : query?.lang;
  const isEnglish = lang === "en";
  const activeStaff = staff.filter((member) => member.isActive);

  return (
    <DashboardLocaleBoundary isEnglish={isEnglish}>
      <div className="grid gap-6">
        <DashboardPageHeader
          eyebrow={isEnglish ? "Staff" : "Personal"}
          title={isEnglish ? "Assign bookings" : "Fördela bokningar"}
          description={isEnglish ? "Assign each booking to an active staff member. Proffera prevents double-booking the same staff member." : "Koppla varje bokning till en aktiv medarbetare. Proffera stoppar dubbelbokning för samma medarbetare."}
          icon={CalendarRange}
          actions={<Link href={localizedHref("/dashboard/personal", isEnglish)} className="inline-flex min-h-11 items-center justify-center rounded-control border border-line bg-surface px-4 py-2.5 text-sm font-bold text-brand">{isEnglish ? "Back to staff register" : "Till personalregistret"}</Link>}
        />

        {query?.updated === "1" ? <p className="rounded-card bg-[#eaf8f2] p-4 text-sm font-semibold text-brand ring-1 ring-[#cfe8d6]">{isEnglish ? "The booking was assigned to the selected staff member." : "Bokningen kopplades till vald medarbetare."}</p> : null}
        {query?.error ? <p className="rounded-card bg-[#fff5f2] p-4 text-sm font-semibold text-danger ring-1 ring-[#f4c7ba]">{isEnglish ? "The assignment could not be saved. The staff member may already be booked at that time." : "Tilldelningen kunde inte sparas. Medarbetaren kan redan vara bokad under samma tid."}</p> : null}

        <section className="rounded-card border border-line bg-surface p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold text-ink">{isEnglish ? "Upcoming bookings" : "Kommande bokningar"}</h2><p className="mt-1 text-sm text-ink-muted">{bookings.length} {isEnglish ? "bookings" : "bokningar"} · {activeStaff.length} {isEnglish ? "active staff members" : "aktiva medarbetare"}</p></div><UsersRound className="h-5 w-5 text-brand" aria-hidden="true" /></div>
          <div className="mt-5 grid gap-3">
            {bookings.length ? bookings.map((booking) => (
              <article key={booking.id} className="grid gap-4 rounded-card border border-line p-4 lg:grid-cols-[1fr_320px] lg:items-center">
                <div><div className="flex flex-wrap items-center gap-2"><Link href={localizedHref(`/dashboard/bokningar/${booking.id}`, isEnglish)} className="font-bold text-ink hover:underline">{booking.customerName}</Link><span className="rounded-full bg-surface-subtle px-2.5 py-1 text-xs font-bold text-ink-muted">{booking.status}</span></div><p className="mt-1 text-sm text-ink-muted">{booking.service}</p><p className="mt-2 text-xs font-semibold text-ink-muted">{formatWorkspaceTime(booking.startsAt, isEnglish, workspaceSettings.timeZone)} – {formatWorkspaceTime(booking.endsAt, isEnglish, workspaceSettings.timeZone)}</p><p className="mt-1 text-xs text-ink-muted">{isEnglish ? "Current" : "Nuvarande"}: {booking.staffName || (isEnglish ? "No staff member" : "Ingen medarbetare")}</p></div>
                <form action={assignStaffAction} className="flex flex-col gap-2 sm:flex-row"><input type="hidden" name="lang" value={isEnglish ? "en" : "sv"}/><input type="hidden" name="booking_id" value={booking.id}/><select name="staff_id" defaultValue={booking.staffId} className="min-h-11 flex-1 rounded-control border border-line bg-surface px-3 text-sm font-semibold text-ink"><option value="">{isEnglish ? "No staff member" : "Ingen medarbetare"}</option>{activeStaff.map((member) => <option key={member.id} value={member.id}>{member.name}{member.roleLabel ? ` · ${member.roleLabel}` : ""}</option>)}</select><button type="submit" className="min-h-11 rounded-control bg-brand-deep px-4 text-sm font-bold text-white transition hover:bg-brand-hover">{isEnglish ? "Save" : "Spara"}</button></form>
              </article>
            )) : <p className="rounded-card border border-dashed border-line-strong bg-surface-subtle p-6 text-sm text-ink-muted">{isEnglish ? "No bookings to assign." : "Inga bokningar att fördela."}</p>}
          </div>
        </section>
      </div>
    </DashboardLocaleBoundary>
  );
}
