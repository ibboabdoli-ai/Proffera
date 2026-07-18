import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Bot,
  CalendarCheck2,
  CalendarPlus,
  CheckCircle2,
  CircleUserRound,
  Settings,
  ShieldCheck,
  UserRoundPlus,
  UserRoundSearch,
  UsersRound,
} from "lucide-react";

import { getDashboardStats } from "@/lib/dashboard-db";
import { getDashboardModuleAccess } from "@/lib/workspace-module-access";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

function countLabel(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

const quickLinks = [
  {
    title: "Leads",
    text: "Prioritera nya förfrågningar och se vilka kontakter som behöver första åtgärd.",
    href: "/dashboard/leads",
    icon: UserRoundSearch,
    label: "Förfrågningar",
    moduleId: "customer_crm",
  },
  {
    title: "Kunder",
    text: "Öppna kundlistan, följ historik och håll ordning på relationer över tid.",
    href: "/dashboard/kunder",
    icon: UsersRound,
    label: "CRM",
    moduleId: "customer_crm",
  },
  {
    title: "Bokningar",
    text: "Se kommande bokningar, status och nästa steg från kundflödet.",
    href: "/dashboard/bokningar",
    icon: CalendarCheck2,
    label: "Planering",
    moduleId: "online_booking",
  },
  {
    title: "AI-assistent",
    text: "Visa hur AI kan fånga frågor, kvalificera behov och skicka vidare tydliga leads.",
    href: "/dashboard/ai-assistent",
    icon: Bot,
    label: "Planerad modul",
    moduleId: undefined,
  },
  {
    title: "Inställningar",
    text: "Hantera företagsprofil, kontaktuppgifter, tjänster och AI-underlag.",
    href: "/dashboard/installningar",
    icon: Settings,
    label: "Konfiguration",
    moduleId: undefined,
  },
] as const;

export default async function DashboardPage() {
  const [moduleAccess, workspaceAccess] = await Promise.all([getDashboardModuleAccess(), getUserWorkspaceAccess()]);
  const isModuleEnabled = (id: "customer_crm" | "online_booking") => moduleAccess.some((module) => module.id === id && module.isEnabled);
  const canUseCrm = isModuleEnabled("customer_crm");
  const canUseBooking = isModuleEnabled("online_booking");
  const hasLimitedAccess = !canUseCrm && !canUseBooking;
  const stats = await getDashboardStats({ includeCustomers: canUseCrm, includeBookings: canUseBooking });
  const visibleQuickLinks = quickLinks.filter((item) => (!item.moduleId || isModuleEnabled(item.moduleId)) && (item.href !== "/dashboard/installningar" || canManageWorkspaceSettings(workspaceAccess)));

  const overviewStats = [
    ...(canUseCrm ? [{
      label: "Kunder",
      value: String(stats.customersCount),
      text: `${countLabel(stats.customersCount, "kund", "kunder")} totalt · ${countLabel(stats.activeCustomersCount, "aktiv", "aktiva")}`,
      icon: UsersRound,
      tone: "bg-[#e9f2ec] text-[#17452f]",
    }] : []),
    ...(canUseBooking ? [{
      label: "Bokningar",
      value: String(stats.bookingsCount),
      text: `${countLabel(stats.bookingsCount, "bokning", "bokningar")} totalt · ${countLabel(stats.confirmedBookingsCount, "bekräftad", "bekräftade")}`,
      icon: CalendarCheck2,
      tone: "bg-[#edf0f8] text-[#405582]",
    }] : []),
    ...(canUseCrm ? [{
      label: "Aktivitet",
      value: String(stats.customerEventsCount),
      text: "Noteringar, bokningar och kundhistorik",
      icon: Activity,
      tone: "bg-[#f8f0df] text-[#8a6722]",
    }] : []),
    {
      label: "Arbetsyta",
      value: "Aktiv",
      text: canUseCrm || canUseBooking ? "Kundportal, leads och bokningar samlade" : "CRM och bokningar är inte aktiverade för arbetsytan",
      icon: ShieldCheck,
      tone: "bg-[#f0ece8] text-[#6d5948]",
    },
  ] as const;

  return (
    <div className="grid gap-6 lg:gap-7">
      <section className="relative overflow-hidden rounded-[28px] bg-[#142b20] px-6 py-8 text-white shadow-[0_20px_60px_rgba(20,43,32,0.18)] sm:px-8 lg:px-10 lg:py-10">
        <div className="absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[#d8ae52]/16 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-[#3d7c59]/25 blur-3xl" aria-hidden="true" />

        <div className="relative grid gap-8 xl:grid-cols-[1fr_auto] xl:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-white/75">
              <span className="h-2 w-2 rounded-full bg-[#73c68f]" aria-hidden="true" />
              Arbetsytan är aktiv
            </div>
            <h2 className="mt-5 max-w-3xl text-3xl font-bold tracking-[-0.035em] text-white sm:text-4xl lg:text-[44px] lg:leading-[1.08]">
              {hasLimitedAccess ? "Din arbetsyta är redo när modulerna aktiveras." : "Full kontroll över varje kundrelation."}
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/65 sm:text-base">
              {hasLimitedAccess ? "CRM och bokningar är inte aktiverade för den här arbetsytan. Kontakta Owner eller Proffera för hjälp." : "Prioritera nya förfrågningar, följ bokningar och håll kundarbetet i rörelse från en samlad översikt."}
            </p>
          </div>

          {canUseCrm || canUseBooking ? <div className="flex flex-col gap-3 sm:flex-row">
            {canUseCrm ? <Link
              href="/dashboard/leads"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-[#173e2b] transition hover:-translate-y-0.5 hover:bg-[#f3f6f2]"
              style={{ color: "#173e2b" }}
            >
              Hantera leads
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link> : null}
            {canUseBooking ? <Link
              href="/dashboard/bokningar/ny"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.07] px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.12]"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Ny bokning
            </Link> : null}
          </div> : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Dashboardöversikt">
        {overviewStats.map((item) => (
          <article
            key={item.label}
            className="rounded-2xl border border-[#e0e5dd] bg-white p-5 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_12px_30px_rgba(20,43,32,0.04)] transition hover:-translate-y-0.5 hover:border-[#cfd8cd] hover:shadow-[0_16px_35px_rgba(20,43,32,0.08)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[#778179]">{item.label}</p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-[#173e2b]">{item.value}</p>
              </div>
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}>
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#667168]">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.7fr)]">
        <div className="rounded-2xl border border-[#e0e5dd] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#17452f]">Snabbvägar</p>
              <h3 className="mt-2 text-xl font-bold tracking-tight text-[#17201a]">{hasLimitedAccess ? "Tillgängliga delar" : "Fortsätt där arbetet händer"}</h3>
            </div>
            <p className="max-w-md text-sm leading-6 text-[#667168]">{hasLimitedAccess ? "Här visas bara delar som är tillgängliga för din roll och arbetsyta." : "Öppna rätt del av kundflödet utan att tappa fokus."}</p>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {visibleQuickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex gap-4 rounded-2xl border border-transparent bg-[#f6f8f5] p-4 transition hover:border-[#d7e0d5] hover:bg-[#eef4ef]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#17452f] shadow-sm ring-1 ring-[#e0e5dd]">
                  <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-bold text-[#17201a]">{item.title}</span>
                    <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[#6a756d] transition group-hover:translate-x-0.5 group-hover:text-[#17452f]" aria-hidden="true" />
                  </span>
                  <span className="mt-1 block text-xs font-bold uppercase tracking-wide text-[#768179]">{item.label}</span>
                  <span className="mt-2 block text-sm leading-6 text-[#667168]">{item.text}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>

        <aside className="rounded-2xl border border-[#e0e5dd] bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#17452f]">Dagens fokus</p>
              <h3 className="mt-2 text-xl font-bold tracking-tight text-[#17201a]">{hasLimitedAccess ? "Åtkomst" : "Nästa steg"}</h3>
            </div>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e9f2ec] text-[#17452f]">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            {canUseBooking ? <Link href="/dashboard/bokningar" className="group flex items-start gap-3 rounded-xl p-2 transition hover:bg-[#f6f8f5]">
              <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#edf0f8] text-[#405582]">
                <CalendarCheck2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-bold text-[#27342c]">Följ bokningarna</span>
                <span className="mt-0.5 block text-sm leading-5 text-[#6a756d]">{stats.confirmedBookingsCount} bekräftade av {stats.bookingsCount}</span>
              </span>
            </Link> : null}
            {canUseCrm ? <><Link href="/dashboard/kunder" className="group flex items-start gap-3 rounded-xl p-2 transition hover:bg-[#f6f8f5]">
              <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#e9f2ec] text-[#17452f]">
                <CircleUserRound className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-bold text-[#27342c]">Vårda kundrelationerna</span>
                <span className="mt-0.5 block text-sm leading-5 text-[#6a756d]">{stats.activeCustomersCount} aktiva av {stats.customersCount}</span>
              </span>
            </Link>
            <Link href="/dashboard/kunder/ny" className="group flex items-start gap-3 rounded-xl p-2 transition hover:bg-[#f6f8f5]">
              <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f8f0df] text-[#8a6722]">
                <UserRoundPlus className="h-4 w-4" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-bold text-[#27342c]">Registrera nästa kund</span>
                <span className="mt-0.5 block text-sm leading-5 text-[#6a756d]">Skapa en komplett kundprofil</span>
              </span>
            </Link></> : null}
            {!canUseCrm && !canUseBooking ? <p className="rounded-xl bg-[#f6f8f5] p-4 text-sm leading-6 text-[#5b665f]">Din arbetsyta har begränsad åtkomst. Kontakta Owner eller Proffera för att aktivera CRM och bokningar.</p> : null}
          </div>
        </aside>
      </section>
    </div>
  );
}
