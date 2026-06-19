import Link from "next/link";

import { getDashboardStats } from "@/lib/dashboard-db";

const quickLinks = [
  {
    title: "Leads",
    text: "Prioritera nya förfrågningar och se vilka kontakter som behöver första åtgärd.",
    href: "/dashboard/leads",
  },
  {
    title: "Kunder",
    text: "Öppna kundlistan, följ historik och håll ordning på relationer över tid.",
    href: "/dashboard/kunder",
  },
  {
    title: "Bokningar",
    text: "Se kommande bokningar, status och nästa steg från kundflödet.",
    href: "/dashboard/bokningar",
  },
  {
    title: "AI-assistent",
    text: "Visa hur AI kan fånga frågor, kvalificera behov och skicka vidare tydliga leads.",
    href: "/dashboard/ai-assistent",
  },
  {
    title: "Inställningar",
    text: "Hantera företagsprofil, kontaktuppgifter, tjänster och AI-underlag.",
    href: "/dashboard/installningar",
  },
] as const;

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const overviewStats = [
    {
      label: "Kunder",
      value: String(stats.customersCount),
      text: `${stats.activeCustomersCount} aktiva kunder`,
    },
    {
      label: "Bokningar",
      value: String(stats.bookingsCount),
      text: `${stats.confirmedBookingsCount} bekräftade bokningar`,
    },
    {
      label: "Aktivitet",
      value: String(stats.customerEventsCount),
      text: "Noteringar, bokningar och kundhistorik",
    },
    {
      label: "Arbetsyta",
      value: "Aktiv",
      text: "Kundportal, leads och bokningar samlade",
    },
  ] as const;

  return (
    <div className="grid gap-8">
      <section className="rounded-3xl bg-[#f7f7f4] p-6 ring-1 ring-[#e4e7df] lg:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Översikt</p>
        <div className="mt-3 grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-[#17201a]">Din samlade vy över kundflödet</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
              Få en snabb bild av leads, kunder, bokningar och aktivitet i arbetsytan. Använd översikten för att välja
              nästa åtgärd och fortsätt sedan till rätt del av kundportalen.
            </p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="text-sm font-semibold text-[#5b665f]">Aktiv arbetsyta</p>
            <p className="mt-2 text-2xl font-bold text-[#17201a]">Proffera</p>
            <p className="mt-1 text-sm text-[#5b665f]">Leads, kunder och bokningar i samma portal.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Dashboardöversikt">
        {overviewStats.map((item) => (
          <article key={item.label} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="text-sm font-semibold text-[#5b665f]">{item.label}</p>
            <p className="mt-3 text-3xl font-bold text-[#17452f]">{item.value}</p>
            <p className="mt-2 text-sm text-[#5b665f]">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Snabbvägar</p>
            <h3 className="mt-2 text-xl font-bold text-[#17201a]">Fortsätt där arbetet händer</h3>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-[#5b665f]">
            Gå direkt till den del av kundflödet som behöver uppmärksamhet just nu.
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group rounded-2xl bg-[#f7f7f4] px-4 py-4 text-sm transition hover:bg-[#eef5ef]"
            >
              <span className="flex items-center justify-between gap-3 font-semibold text-[#17201a]">
                {item.title}
                <span className="text-[#17452f] transition group-hover:translate-x-0.5">→</span>
              </span>
              <span className="mt-2 block leading-6 text-[#5b665f]">{item.text}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
