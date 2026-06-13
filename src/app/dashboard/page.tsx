import { getDashboardStats } from "@/lib/dashboard-db";

const modules = [
  "Leadlista med status",
  "Kundprofiler och historik",
  "Bokningskalender",
  "AI-assistent för frågor",
  "Notiser och bekräftelser",
  "Inställningar för tjänster",
] as const;

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const overviewStats = [
    {
      label: "Kunder",
      value: String(stats.customersCount),
      text: `${stats.activeCustomersCount} aktiva kunder i CRM`,
    },
    {
      label: "Bokningar",
      value: String(stats.bookingsCount),
      text: `${stats.confirmedBookingsCount} bekräftade bokningar`,
    },
    {
      label: "Kundhändelser",
      value: String(stats.customerEventsCount),
      text: "Noteringar, bokningar och historik",
    },
    {
      label: "Läge",
      value: "Read-only",
      text: "Dashboard läser från Neon utan write actions",
    },
  ] as const;

  return (
    <div className="grid gap-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Översikt</p>
        <h2 className="mt-2 text-3xl font-bold text-[#17201a]">SaaS dashboard shell</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
          Detta är en read-only dashboard-grund för Proffera som produkt. Översikten läser nu verifierad CRM- och bokningsdata från Neon.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overviewStats.map((item) => (
          <article key={item.label} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="text-sm font-semibold text-[#5b665f]">{item.label}</p>
            <p className="mt-3 text-3xl font-bold text-[#17452f]">{item.value}</p>
            <p className="mt-2 text-sm text-[#5b665f]">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
        <h3 className="text-xl font-bold text-[#17201a]">Planerade moduler</h3>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <div key={module} className="rounded-2xl bg-[#f7f7f4] px-4 py-3 text-sm font-semibold text-[#344139]">
              {module}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
