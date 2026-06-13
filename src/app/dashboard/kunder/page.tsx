import Link from "next/link";

import { getDashboardCustomers } from "@/lib/dashboard-db";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  prospect: "Prospekt",
  active: "Aktiv",
  paused: "Pausad",
  lost: "Förlorad",
};

export default async function CustomersPage() {
  const customers = await getDashboardCustomers();
  const activeCustomers = customers.filter((customer) => customer.status === "active").length;
  const prospects = customers.filter((customer) => customer.status === "prospect").length;

  const pipeline = [
    { label: "Kontakter i CRM", value: String(customers.length) },
    { label: "Aktiva kunder", value: String(activeCustomers) },
    { label: "Prospekt", value: String(prospects) },
  ] as const;

  return (
    <div className="grid gap-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Kunder</p>
        <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Kund-CRM</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
          Read-only vy från Profferas CRM-tabell. Data hämtas från Neon utan att skapa eller ändra kundposter.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {pipeline.map((item) => (
          <article key={item.label} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="text-sm text-[#5b665f]">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-[#17452f]">{item.value}</p>
          </article>
        ))}
      </section>

      {customers.length === 0 ? (
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <h3 className="text-lg font-bold text-[#17201a]">Inga kunder hittades</h3>
          <p className="mt-2 text-sm leading-7 text-[#5b665f]">
            Det finns ännu inga CRM-poster att visa för workspace default.
          </p>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-3">
          {customers.map((customer) => (
            <article key={customer.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-bold text-[#17201a]">{customer.name}</p>
                  <p className="mt-2 text-sm text-[#5b665f]">
                    {customer.type} · {customer.city}
                  </p>
                </div>
                <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">
                  {statusLabels[customer.status] ?? customer.status}
                </span>
              </div>
              <div className="mt-5 grid gap-3 rounded-2xl bg-[#f7f7f4] p-4 text-sm text-[#344139]">
                <p>
                  <strong>Tjänst:</strong> {customer.service}
                </p>
                <p>
                  <strong>Notering:</strong> {customer.notes}
                </p>
              </div>
              <Link
                href={`/dashboard/kunder/${customer.id}`}
                className="mt-5 inline-flex rounded-full bg-[#17452f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f2f20]"
              >
                Visa profil
              </Link>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
