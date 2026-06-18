import Link from "next/link";

import { getDashboardCustomers } from "@/lib/dashboard-db";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  prospect: "Prospekt",
  active: "Aktiv",
  paused: "Pausad",
  lost: "Förlorad",
};

const statusStyles: Record<string, string> = {
  prospect: "bg-[#e7f1eb] text-[#17452f]",
  active: "bg-[#e7f1eb] text-[#17452f]",
  paused: "bg-[#fff4d7] text-[#6f4f00]",
  lost: "bg-[#f8e7e7] text-[#7a2626]",
};

function getNextStep(status: string) {
  if (status === "active") return "Följ upp relation";
  if (status === "paused") return "Planera nästa kontakt";
  if (status === "lost") return "Arkivera eller återvinn";

  return "Kvalificera kund";
}

export default async function CustomersPage() {
  const customers = await getDashboardCustomers();
  const activeCustomers = customers.filter((customer) => customer.status === "active").length;
  const prospects = customers.filter((customer) => customer.status === "prospect").length;
  const companies = customers.filter((customer) => customer.type === "Företag").length;

  const stats = [
    { label: "Visade kunder", value: String(customers.length), helper: "Senaste kundposterna i listan" },
    { label: "Aktiva i listan", value: String(activeCustomers), helper: "Pågående relationer" },
    { label: "Prospekt i listan", value: String(prospects), helper: "Kan följas upp" },
    { label: "Företag i listan", value: String(companies), helper: "B2B-kontakter bland visade kunder" },
  ] as const;

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Kunder</p>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-[#17201a]">Samlad kundöversikt</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
              Se de senaste kunderna och prospekten på ett ställe. Följ status, tjänst, ort och nästa steg så att ingen kundrelation tappas bort.
            </p>
          </div>
          <Link
            href="/dashboard/kunder/ny"
            className="inline-flex w-fit rounded-full bg-[#17452f] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f2f20] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17452f]"
          >
            Ny kund
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {stats.map((item) => (
          <article key={item.label} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="text-sm text-[#5b665f]">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-[#17452f]">{item.value}</p>
            <p className="mt-2 text-xs text-[#6d7770]">{item.helper}</p>
          </article>
        ))}
      </section>

      {customers.length === 0 ? (
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <h3 className="text-lg font-bold text-[#17201a]">Inga kunder ännu</h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-[#5b665f]">
            När nya kunder eller prospekt läggs till visas de här med status, tjänst och uppföljning.
          </p>
          <Link
            href="/dashboard/kunder/ny"
            className="mt-5 inline-flex rounded-full bg-[#17452f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0f2f20]"
          >
            Lägg till första kunden
          </Link>
        </section>
      ) : (
        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#dfe5dd]">
          <div className="border-b border-[#dfe5dd] px-5 py-4">
            <h3 className="text-lg font-bold text-[#17201a]">Aktuella kunder</h3>
            <p className="mt-1 text-sm text-[#5b665f]">
              Översikt med kundtyp, tjänst, ort, status och föreslagen uppföljning.
            </p>
          </div>
          <div className="hidden grid-cols-6 gap-4 border-b border-[#dfe5dd] bg-[#f7f7f4] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#344139] md:grid">
            <span>Kund</span>
            <span>Typ</span>
            <span>Tjänst</span>
            <span>Ort</span>
            <span>Status</span>
            <span>Nästa steg</span>
          </div>
          {customers.map((customer) => (
            <div key={customer.id} className="grid gap-3 border-b border-[#eef1ec] px-5 py-4 text-sm text-[#344139] last:border-0 md:grid-cols-6 md:gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Kund</p>
                <p className="font-semibold text-[#17201a]">{customer.name}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Typ</p>
                <p>{customer.type}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Tjänst</p>
                <p>{customer.service}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Ort</p>
                <p>{customer.city}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Status</p>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[customer.status] ?? "bg-[#e7f1eb] text-[#17452f]"}`}>
                  {statusLabels[customer.status] ?? customer.status}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Nästa steg</p>
                <Link
                  href={`/dashboard/kunder/${customer.id}`}
                  className="font-semibold text-[#17452f] transition hover:text-[#0f2f20]"
                >
                  {getNextStep(customer.status)}
                </Link>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl bg-[#17452f] p-6 text-white md:col-span-2">
          <h3 className="text-xl font-bold">Bygg långsiktiga kundrelationer</h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-white/80">
            Använd kundlistan för att se vilka kontakter som är aktiva, vilka som behöver uppföljning och vilka tjänster varje kund är intresserad av.
          </p>
        </article>
        <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Nästa förbättring</p>
          <h3 className="mt-2 text-xl font-bold text-[#17201a]">Mer kunddata</h3>
          <p className="mt-2 text-sm leading-7 text-[#5b665f]">
            Nästa CRM-fas kan lägga till kontaktperson, senaste aktivitet, kundvärde och automatiska påminnelser.
          </p>
        </article>
      </section>
    </div>
  );
}
