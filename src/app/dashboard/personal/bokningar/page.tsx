import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarRange, UsersRound } from "lucide-react";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getDashboardStaff } from "@/lib/dashboard-staff";
import { assignStaffToBooking, getStaffBookingAssignments } from "@/lib/dashboard-staff-bookings";

export const dynamic = "force-dynamic";

function formatStockholm(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function assignStaffAction(formData: FormData) {
  "use server";
  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const staffId = String(formData.get("staff_id") ?? "").trim();
  try {
    await assignStaffToBooking(bookingId, staffId);
  } catch (error) {
    console.error("Failed to assign staff to booking", error);
    redirect("/dashboard/personal/bokningar?error=conflict");
  }
  redirect("/dashboard/personal/bokningar?updated=1");
}

export default async function StaffBookingAssignmentPage({
  searchParams,
}: {
  searchParams?: Promise<{ updated?: string; error?: string }>;
}) {
  const [staff, bookings, query] = await Promise.all([
    getDashboardStaff(),
    getStaffBookingAssignments(),
    searchParams ?? Promise.resolve(undefined),
  ]);
  const activeStaff = staff.filter((member) => member.isActive);

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow="Personal"
        title="Fördela bokningar"
        description="Koppla varje bokning till en aktiv medarbetare. Proffera stoppar dubbelbokning för samma medarbetare."
        icon={CalendarRange}
        actions={
          <Link href="/dashboard/personal" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#d5ddd3] bg-white px-4 py-2.5 text-sm font-bold text-[#17452f]">
            Till personalregistret
          </Link>
        }
      />

      {query?.updated === "1" ? (
        <p className="rounded-2xl bg-[#eef8f1] p-4 text-sm font-semibold text-[#17452f] ring-1 ring-[#cfe8d6]">Bokningen kopplades till vald medarbetare.</p>
      ) : null}
      {query?.error ? (
        <p className="rounded-2xl bg-[#fff5f2] p-4 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">Tilldelningen kunde inte sparas. Medarbetaren kan redan vara bokad under samma tid.</p>
      ) : null}

      <section className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#17201a]">Kommande bokningar</h2>
            <p className="mt-1 text-sm text-[#5b665f]">{bookings.length} bokningar · {activeStaff.length} aktiva medarbetare</p>
          </div>
          <UsersRound className="h-5 w-5 text-[#17452f]" aria-hidden="true" />
        </div>

        <div className="mt-5 grid gap-3">
          {bookings.length ? bookings.map((booking) => (
            <article key={booking.id} className="grid gap-4 rounded-2xl border border-[#e2e7df] p-4 lg:grid-cols-[1fr_320px] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/dashboard/bokningar/${booking.id}`} className="font-bold text-[#17201a] hover:underline">{booking.customerName}</Link>
                  <span className="rounded-full bg-[#f1f3ef] px-2.5 py-1 text-xs font-bold text-[#566159]">{booking.status}</span>
                </div>
                <p className="mt-1 text-sm text-[#5b665f]">{booking.service}</p>
                <p className="mt-2 text-xs font-semibold text-[#6b766e]">{formatStockholm(booking.startsAt)} – {formatStockholm(booking.endsAt)}</p>
                <p className="mt-1 text-xs text-[#6b766e]">Nuvarande: {booking.staffName || "Ingen medarbetare"}</p>
              </div>

              <form action={assignStaffAction} className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="booking_id" value={booking.id} />
                <select name="staff_id" defaultValue={booking.staffId} className="min-h-11 flex-1 rounded-xl border border-[#d9e1d7] bg-white px-3 text-sm font-semibold text-[#17201a]">
                  <option value="">Ingen medarbetare</option>
                  {activeStaff.map((member) => <option key={member.id} value={member.id}>{member.name}{member.roleLabel ? ` · ${member.roleLabel}` : ""}</option>)}
                </select>
                <button type="submit" className="min-h-11 rounded-xl bg-[#173e2b] px-4 text-sm font-bold text-white">Spara</button>
              </form>
            </article>
          )) : (
            <p className="rounded-2xl border border-dashed border-[#ced8cc] bg-[#f7f9f6] p-6 text-sm text-[#667168]">Inga bokningar att fördela.</p>
          )}
        </div>
      </section>
    </div>
  );
}
