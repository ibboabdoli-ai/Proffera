import Link from "next/link";
import { Building2, CircleDot, UserRoundPlus, UserRoundSearch, UsersRound } from "lucide-react";

import { DashboardDataPanel, DashboardMetricGrid, DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
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
    { label: "Visade kunder", value: String(customers.length), helper: "Senaste kundposterna i listan", icon: UsersRound, tone: "bg-[#e9f2ec] text-[#17452f]" },
    { label: "Aktiva i listan", value: String(activeCustomers), helper: "Pågående kundrelationer", icon: CircleDot, tone: "bg-[#edf0f8] text-[#405582]" },
    { label: "Prospekt i listan", value: String(prospects), helper: "Kontakter att följa upp", icon: UserRoundSearch, tone: "bg-[#f8f0df] text-[#8a6722]" },
    { label: "Företag i listan", value: String(companies), helper: "B2B-kontakter bland kunderna", icon: Building2, tone: "bg-[#f0ece8] text-[#6d5948]" },
  ] as const;

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow="Kunder"
        title="Samlad kundöversikt"
        description="Se de senaste kunderna och prospekten på ett ställe. Följ status, tjänst, ort och nästa steg så att ingen kundrelation tappas bort."
        icon={UsersRound}
        actions={
          <Link href="/dashboard/kunder/ny" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#0f3020]">
            <UserRoundPlus className="h-4 w-4" aria-hidden="true" />
            Ny kund
          </Link>
        }
      />

      <DashboardMetricGrid items={stats} />

      {customers.length === 0 ? (
        <DashboardDataPanel title="Aktuella kunder" description="Kundregistret är redo för din första kundrelation." count={0}>
          <div className="p-5 sm:p-6">
            <div className="rounded-2xl border border-dashed border-[#ced8cc] bg-[#f7f9f6] px-5 py-8 text-center">
              <h3 className="text-lg font-bold text-[#17201a]">Inga kunder ännu</h3>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-[#667168]">När nya kunder eller prospekt läggs till visas de här med status, tjänst och uppföljning.</p>
              <Link href="/dashboard/kunder/ny" className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[#173e2b] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0f3020]">Lägg till första kunden</Link>
            </div>
          </div>
        </DashboardDataPanel>
      ) : (
        <DashboardDataPanel title="Aktuella kunder" description="Översikt med kundtyp, tjänst, ort, status och föreslagen uppföljning." count={customers.length}>
          <div className="hidden grid-cols-[1.25fr_0.75fr_1fr_0.8fr_0.75fr_1fr_1.1fr] gap-4 border-b border-[#e5e9e2] bg-[#f7f9f6] px-6 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#778179] lg:grid">
            <span>Kund</span>
            <span>Typ</span>
            <span>Tjänst</span>
            <span>Ort</span>
            <span>Status</span>
            <span>Nästa steg</span>
            <span>Profil</span>
          </div>
          {customers.map((customer) => (
            <div key={customer.id} className="mx-3 my-3 grid gap-3 rounded-2xl border border-[#e2e7df] bg-white p-4 text-sm text-[#435047] shadow-sm lg:mx-0 lg:my-0 lg:grid-cols-[1.25fr_0.75fr_1fr_0.8fr_0.75fr_1fr_1.1fr] lg:items-center lg:gap-4 lg:rounded-none lg:border-x-0 lg:border-t-0 lg:px-6 lg:py-4 lg:shadow-none lg:last:border-b-0">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] lg:hidden">Kund</p>
                <p className="font-semibold text-[#17201a]">{customer.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] lg:hidden">Typ</p>
                <p>{customer.type}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] lg:hidden">Tjänst</p>
                <p>{customer.service}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] lg:hidden">Ort</p>
                <p>{customer.city}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] lg:hidden">Status</p>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[customer.status] ?? "bg-[#e7f1eb] text-[#17452f]"}`}>
                  {statusLabels[customer.status] ?? customer.status}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] lg:hidden">Nästa steg</p>
                <p className="font-semibold text-[#17452f]">{getNextStep(customer.status)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] lg:hidden">Profil</p>
                <Link
                  href={`/dashboard/kunder/${customer.id}`}
                  className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[#173e2b] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#0f3020]"
                >
                  Visa kundprofil
                </Link>
              </div>
            </div>
          ))}
        </DashboardDataPanel>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[24px] bg-[#173e2b] p-6 text-white shadow-[0_14px_36px_rgba(20,43,32,0.12)] md:col-span-2">
          <h3 className="text-xl font-bold">Bygg långsiktiga kundrelationer</h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-white/80">
            Använd kundlistan för att se vilka kontakter som är aktiva, vilka som behöver uppföljning och vilka tjänster varje kund är intresserad av.
          </p>
        </article>
        <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Kundarbete</p>
          <h3 className="mt-2 text-xl font-bold text-[#17201a]">Mer kunddata</h3>
          <p className="mt-2 text-sm leading-7 text-[#5b665f]">
            Lägg till kontaktpersoner, senaste aktivitet, kundvärde och påminnelser när kundflödet behöver mer detaljer.
          </p>
        </article>
      </section>
    </div>
  );
}
