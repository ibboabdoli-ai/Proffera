import Link from "next/link";

import { getDashboardBookings } from "@/lib/dashboard-db";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  draft: "Utkast",
  requested: "Förfrågan",
  confirmed: "Bekräftad",
  completed: "Klar",
  cancelled: "Avbokad",
  no_show: "Uteblev",
};

const statusStyles: Record<string, string> = {
  draft: "bg-[#f1f2ed] text-[#5b665f]",
  requested: "bg-[#fff4d7] text-[#6f4f00]",
  confirmed: "bg-[#e7f1eb] text-[#17452f]",
  completed: "bg-[#e7edf8] text-[#1f3f6f]",
  cancelled: "bg-[#f8e7e7] text-[#7a1f1f]",
  no_show: "bg-[#f8e7e7] text-[#7a1f1f]",
};

function getNextStep(status: string) {
  if (status === "confirmed") return "Förbered besök";
  if (status === "completed") return "Följ upp kund";
  if (status === "cancelled") return "Boka om";
  if (status === "no_show") return "Kontakta kund";
  return "Bekräfta tid";
}

export default async function BookingsPage() {
  const bookings = await getDashboardBookings();
  const confirmedBookings = bookings.filter((booking) => booking.status === "confirmed").length;
  const requestedBookings = bookings.filter((booking) => booking.status === "requested").length;
  const completedBookings = bookings.filter((booking) => booking.status === "completed").length;

  const summary = [
    { label: "Visade bokningar", value: String(bookings.length), helper: "Kommande och senaste tider" },
    { label: "Bekräftade i listan", value: String(confirmedBookings), helper: "Redo att utföras" },
    { label: "Förfrågningar i listan", value: String(requestedBookings), helper: "Väntar på svar" },
    { label: "Klara i listan", value: String(completedBookings), helper: "Kan följas upp" },
  ] as const;

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Bokningar</p>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-[#17201a]">Planera och följ bokningar</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
              Här visas aktuella bokningar med tid, kund, tjänst, ort och nästa steg. Använd vyn för att snabbt se vad som behöver bekräftas, utföras eller följas upp.
            </p>
          </div>
          <Link
            href="/dashboard/bokningar/ny"
            className="inline-flex rounded-full bg-[#17452f] px-5 py-3 text-sm font-semibold !text-white shadow-sm transition hover:bg-[#0f3322] hover:!text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17452f]"
          >
            Ny bokning
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {summary.map((item) => (
          <article key={item.label} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="text-sm text-[#5b665f]">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-[#17452f]">{item.value}</p>
            <p className="mt-2 text-xs text-[#6d7770]">{item.helper}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#dfe5dd]">
        <div className="border-b border-[#dfe5dd] px-5 py-4">
          <h3 className="text-lg font-bold text-[#17201a]">Aktuella bokningar</h3>
          <p className="mt-1 text-sm text-[#5b665f]">Översikt med tid, kund, tjänst, status och nästa åtgärd.</p>
        </div>

        {bookings.length === 0 ? (
          <div className="p-5">
            <div className="rounded-2xl bg-[#f7f7f4] p-5 text-sm text-[#5b665f]">
              <h4 className="font-bold text-[#17201a]">Inga bokningar ännu</h4>
              <p className="mt-2 leading-7">
                När bokningar skapas visas de här med tid, kund, status och länk till bokningsprofilen.
              </p>
              <Link href="/dashboard/bokningar/ny" className="mt-4 inline-flex rounded-full bg-[#17452f] px-4 py-2 text-xs font-semibold !text-white transition hover:bg-[#0f3322] hover:!text-white">
                Skapa första bokningen
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-7 gap-4 border-b border-[#dfe5dd] bg-[#f7f7f4] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#344139] md:grid">
              <span>Tid</span>
              <span>Kund</span>
              <span>Tjänst</span>
              <span>Ort</span>
              <span>Status</span>
              <span>Nästa steg</span>
              <span>Profil</span>
            </div>
            {bookings.map((booking) => (
              <div key={booking.id} className="grid gap-3 border-b border-[#eef1ec] px-5 py-4 text-sm text-[#344139] last:border-0 md:grid-cols-7 md:gap-4 md:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Tid</p>
                  <p className="font-semibold text-[#17452f]">{booking.time}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Kund</p>
                  <p className="font-semibold text-[#17201a]">{booking.customer}</p>
                  <p className="text-xs text-[#6d7770]">{booking.title}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Tjänst</p>
                  <p>{booking.service}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Ort</p>
                  <p>{booking.city}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Status</p>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[booking.status] ?? "bg-[#f1f2ed] text-[#5b665f]"}`}>
                    {statusLabels[booking.status] ?? booking.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Nästa steg</p>
                  <p className="font-semibold text-[#17452f]">{getNextStep(booking.status)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Profil</p>
                  <Link
                    href={`/dashboard/bokningar/${booking.id}`}
                    className="inline-flex rounded-full bg-[#17452f] px-3 py-1 text-xs font-semibold !text-white transition hover:bg-[#0f3322] hover:!text-white"
                  >
                    Visa bokning
                  </Link>
                </div>
              </div>
            ))}
          </>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl bg-[#17452f] p-6 md:col-span-2">
          <h3 className="text-xl font-bold text-white">Mindre manuellt arbete</h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[#e7f1eb]">
            En tydlig bokningsvy gör det enklare att se vilka tider som ska bekräftas, vilka jobb som är redo och vilka kunder som behöver uppföljning.
          </p>
        </article>
        <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Bokningsarbete</p>
          <h3 className="mt-2 text-xl font-bold text-[#17201a]">Påminnelser och kalender</h3>
          <p className="mt-2 text-sm leading-7 text-[#5b665f]">
            Automatiska bekräftelser, påminnelser och kalenderkopplingar gör det enklare att hålla varje bokning uppdaterad.
          </p>
        </article>
      </section>
    </div>
  );
}
