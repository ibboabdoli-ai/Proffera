import Link from "next/link";
import { notFound } from "next/navigation";

import { getDashboardCustomerDetail } from "@/lib/dashboard-db";

export const dynamic = "force-dynamic";

type CustomerDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const customerStatusLabels: Record<string, string> = {
  prospect: "Prospekt",
  active: "Aktiv",
  paused: "Pausad",
  lost: "Förlorad",
};

const bookingStatusLabels: Record<string, string> = {
  draft: "Utkast",
  requested: "Förfrågad",
  confirmed: "Bekräftad",
  completed: "Klar",
  cancelled: "Avbokad",
  no_show: "Uteblev",
};

const eventTypeLabels: Record<string, string> = {
  note: "Notering",
  call: "Samtal",
  email: "E-post",
  booking: "Bokning",
  status_change: "Statusändring",
  ai_conversation: "AI-dialog",
};

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;
  const detail = await getDashboardCustomerDetail(id);

  if (!detail) {
    notFound();
  }

  const { customer, bookings, events } = detail;

  return (
    <div className="grid gap-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Kundprofil</p>
          <h2 className="mt-2 text-3xl font-bold text-[#17201a]">{customer.name}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
            Read-only kundprofil från Neon. Profil, bokningar och historik visas utan att skapa eller ändra CRM-data.
          </p>
        </div>
        <Link
          href="/dashboard/kunder"
          className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[#17452f] shadow-sm ring-1 ring-[#dfe5dd] transition hover:bg-[#f7f7f4]"
        >
          Tillbaka till kunder
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#dfe5dd]">
          <p className="text-sm text-[#5b665f]">Status</p>
          <p className="mt-2 text-xl font-bold text-[#17452f]">
            {customerStatusLabels[customer.status] ?? customer.status}
          </p>
        </article>
        <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#dfe5dd]">
          <p className="text-sm text-[#5b665f]">Bokningar</p>
          <p className="mt-2 text-xl font-bold text-[#17452f]">{bookings.length}</p>
        </article>
        <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#dfe5dd]">
          <p className="text-sm text-[#5b665f]">Händelser</p>
          <p className="mt-2 text-xl font-bold text-[#17452f]">{events.length}</p>
        </article>
        <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#dfe5dd]">
          <p className="text-sm text-[#5b665f]">Läge</p>
          <p className="mt-2 text-xl font-bold text-[#17452f]">Read-only</p>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-6">
          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <h3 className="text-xl font-bold text-[#17201a]">Profil</h3>
            <div className="mt-5 grid gap-3 rounded-2xl bg-[#f7f7f4] p-4 text-sm text-[#344139] sm:grid-cols-2">
              <p>
                <strong>Kundtyp:</strong> {customer.type}
              </p>
              <p>
                <strong>Ort:</strong> {customer.city}
              </p>
              <p>
                <strong>E-post:</strong> {customer.email}
              </p>
              <p>
                <strong>Telefon:</strong> {customer.phone}
              </p>
              <p>
                <strong>Företag:</strong> {customer.companyName}
              </p>
              <p>
                <strong>Källa:</strong> {customer.source}
              </p>
              <p>
                <strong>Tjänst:</strong> {customer.service}
              </p>
              <p>
                <strong>Skapad:</strong> {customer.createdAt}
              </p>
            </div>
            <p className="mt-4 rounded-2xl bg-[#f7f7f4] p-4 text-sm leading-7 text-[#344139]">
              <strong>Notering:</strong> {customer.notes}
            </p>
          </article>

          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <div className="flex items-center justify-between border-b border-[#dfe5dd] pb-4">
              <div>
                <h3 className="text-xl font-bold text-[#17201a]">Bokningar</h3>
                <p className="text-sm text-[#5b665f]">Read-only bokningar kopplade till kunden.</p>
              </div>
              <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">Neon data</span>
            </div>
            {bookings.length === 0 ? (
              <p className="mt-5 rounded-2xl bg-[#f7f7f4] p-4 text-sm text-[#5b665f]">
                Inga bokningar hittades för den här kunden.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {bookings.map((booking) => (
                  <div key={booking.id} className="grid gap-2 rounded-2xl bg-[#f7f7f4] p-4 sm:grid-cols-[170px_1fr_auto] sm:items-center">
                    <span className="font-bold text-[#17452f]">{booking.time}</span>
                    <span>
                      <strong>{booking.title}</strong>
                      <br />
                      <span className="text-sm text-[#5b665f]">
                        {booking.city} · {booking.service}
                      </span>
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#344139]">
                      {bookingStatusLabels[booking.status] ?? booking.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>

        <aside className="rounded-3xl bg-[#17452f] p-6 text-white">
          <h3 className="text-xl font-bold">Kundhistorik</h3>
          <p className="mt-3 text-sm leading-7 text-white/80">
            Händelser från CRM-tabellen visas i read-only läge. Senare kan detta kopplas till samtal, e-post och AI-dialoger.
          </p>
          <div className="mt-5 space-y-3">
            {events.length === 0 ? (
              <p className="rounded-2xl bg-white/10 p-4 text-sm text-white/80">Inga händelser hittades.</p>
            ) : (
              events.map((event) => (
                <div key={event.id} className="rounded-2xl bg-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                      {eventTypeLabels[event.type] ?? event.type}
                    </span>
                    <span className="text-xs text-white/70">{event.createdAt}</span>
                  </div>
                  <p className="mt-3 font-semibold">{event.title}</p>
                  <p className="mt-2 text-sm leading-6 text-white/80">{event.description}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>
    </div>
  );
}
