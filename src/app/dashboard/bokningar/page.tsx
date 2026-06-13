import Link from "next/link";

import { getDashboardBookings } from "@/lib/dashboard-db";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  draft: "Utkast",
  requested: "Förfrågad",
  confirmed: "Bekräftad",
  completed: "Klar",
  cancelled: "Avbokad",
  no_show: "Uteblev",
};

export default async function BookingsPage() {
  const bookings = await getDashboardBookings();
  const confirmedBookings = bookings.filter((booking) => booking.status === "confirmed").length;
  const requestedBookings = bookings.filter((booking) => booking.status === "requested").length;
  const completedBookings = bookings.filter((booking) => booking.status === "completed").length;

  const summary = [
    { label: "Bokningar i CRM", value: String(bookings.length) },
    { label: "Bekräftade", value: String(confirmedBookings) },
    { label: "Förfrågade", value: String(requestedBookings) },
    { label: "Klara", value: String(completedBookings) },
  ] as const;

  return (
    <div className="grid gap-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Bokningar</p>
        <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Bokningsöversikt</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
          Read-only vy från Profferas bokningstabell. Data hämtas från Neon utan att skapa eller ändra bokningar i listvyn.
        </p>
        <Link
          href="/dashboard/bokningar/ny"
          className="mt-5 inline-flex rounded-full bg-[#17452f] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f3322] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17452f]"
        >
          Ny bokning
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {summary.map((item) => (
          <article key={item.label} className="rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="text-sm font-semibold text-[#344139]">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-[#17452f]">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <div className="flex items-center justify-between border-b border-[#dfe5dd] pb-4">
            <div>
              <h3 className="text-xl font-bold text-[#17201a]">Kommande schema</h3>
              <p className="text-sm text-[#5b665f]">Read-only lista med tid, kund och status.</p>
            </div>
            <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">Neon data</span>
          </div>
          {bookings.length === 0 ? (
            <div className="mt-5 rounded-2xl bg-[#f7f7f4] p-4 text-sm text-[#5b665f]">
              Det finns ännu inga bokningar att visa för workspace default.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {bookings.map((booking) => (
                <div key={booking.id} className="grid gap-2 rounded-2xl bg-[#f7f7f4] p-4 sm:grid-cols-[170px_1fr_auto] sm:items-center">
                  <span className="font-bold text-[#17452f]">{booking.time}</span>
                  <span>
                    <strong>{booking.title}</strong>
                    <br />
                    <span className="text-sm text-[#5b665f]">
                      {booking.customer} · {booking.city} · {booking.service}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#344139]">
                      {statusLabels[booking.status] ?? booking.status}
                    </span>
                    <Link
                      href={`/dashboard/bokningar/${booking.id}`}
                      className="rounded-full bg-[#17452f] px-3 py-1 text-xs font-semibold text-white transition hover:bg-[#0f3322]"
                    >
                      Visa bokning
                    </Link>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <aside className="rounded-3xl bg-[#17452f] p-6 text-white">
          <h3 className="text-xl font-bold">Kommande automation</h3>
          <p className="mt-3 text-sm leading-7 text-white/80">
            Bokningar kan senare kopplas till automatiska bekräftelser, påminnelser och kalenderintegration.
          </p>
        </aside>
      </section>
    </div>
  );
}
