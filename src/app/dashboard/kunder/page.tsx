import Link from "next/link";
import { Building2, CircleDot, UserRoundPlus, UserRoundSearch, UsersRound } from "lucide-react";

import { DashboardDataPanel, DashboardMetricGrid, DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getDashboardCustomers } from "@/lib/dashboard-db";

export const dynamic = "force-dynamic";

type CustomersPageProps = {
  searchParams?: Promise<{ lang?: string | string[] }>;
};

const statusStyles: Record<string, string> = {
  prospect: "bg-[#e7f1eb] text-[#17452f]",
  active: "bg-[#e7f1eb] text-[#17452f]",
  paused: "bg-[#fff4d7] text-[#6f4f00]",
  lost: "bg-[#f8e7e7] text-[#7a2626]",
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const langValue = Array.isArray(params?.lang) ? params.lang[0] : params?.lang;
  const isEnglish = langValue === "en";
  const withLocale = (href: string) => isEnglish ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href;

  const copy = isEnglish ? {
    statusLabels: { prospect: "Prospect", active: "Active", paused: "Paused", lost: "Lost" } as Record<string, string>,
    nextStep: { active: "Follow up relationship", paused: "Plan next contact", lost: "Archive or re-engage", prospect: "Qualify customer" } as Record<string, string>,
    eyebrow: "Customers",
    title: "Complete customer overview",
    description: "See your latest customers and prospects in one place. Track status, service, location and the next step so no customer relationship is lost.",
    newCustomer: "New customer",
    stats: [
      ["Customers shown", "Latest customer records in the list"],
      ["Active customers", "Ongoing customer relationships"],
      ["Prospects", "Contacts requiring follow-up"],
      ["Companies", "B2B contacts among customers"],
    ],
    panelTitle: "Current customers",
    emptyDescription: "The customer register is ready for your first customer relationship.",
    emptyTitle: "No customers yet",
    emptyText: "When customers or prospects are added, they will appear here with status, service and follow-up details.",
    addFirst: "Add first customer",
    panelDescription: "Overview of customer type, service, location, status and suggested follow-up.",
    columns: ["Customer", "Type", "Service", "Location", "Status", "Next step", "Profile"],
    viewProfile: "View customer profile",
    relationshipTitle: "Build long-term customer relationships",
    relationshipText: "Use the customer list to see which contacts are active, which require follow-up and which services each customer is interested in.",
    customerWork: "Customer management",
    moreData: "More customer data",
    moreDataText: "Add contact persons, latest activity, customer value and reminders when the customer workflow needs more detail.",
  } : {
    statusLabels: { prospect: "Prospekt", active: "Aktiv", paused: "Pausad", lost: "Förlorad" } as Record<string, string>,
    nextStep: { active: "Följ upp relation", paused: "Planera nästa kontakt", lost: "Arkivera eller återvinn", prospect: "Kvalificera kund" } as Record<string, string>,
    eyebrow: "Kunder",
    title: "Samlad kundöversikt",
    description: "Se de senaste kunderna och prospekten på ett ställe. Följ status, tjänst, ort och nästa steg så att ingen kundrelation tappas bort.",
    newCustomer: "Ny kund",
    stats: [
      ["Visade kunder", "Senaste kundposterna i listan"],
      ["Aktiva i listan", "Pågående kundrelationer"],
      ["Prospekt i listan", "Kontakter att följa upp"],
      ["Företag i listan", "B2B-kontakter bland kunderna"],
    ],
    panelTitle: "Aktuella kunder",
    emptyDescription: "Kundregistret är redo för din första kundrelation.",
    emptyTitle: "Inga kunder ännu",
    emptyText: "När nya kunder eller prospekt läggs till visas de här med status, tjänst och uppföljning.",
    addFirst: "Lägg till första kunden",
    panelDescription: "Översikt med kundtyp, tjänst, ort, status och föreslagen uppföljning.",
    columns: ["Kund", "Typ", "Tjänst", "Ort", "Status", "Nästa steg", "Profil"],
    viewProfile: "Visa kundprofil",
    relationshipTitle: "Bygg långsiktiga kundrelationer",
    relationshipText: "Använd kundlistan för att se vilka kontakter som är aktiva, vilka som behöver uppföljning och vilka tjänster varje kund är intresserad av.",
    customerWork: "Kundarbete",
    moreData: "Mer kunddata",
    moreDataText: "Lägg till kontaktpersoner, senaste aktivitet, kundvärde och påminnelser när kundflödet behöver mer detaljer.",
  };

  const customers = await getDashboardCustomers();
  const activeCustomers = customers.filter((customer) => customer.status === "active").length;
  const prospects = customers.filter((customer) => customer.status === "prospect").length;
  const companies = customers.filter((customer) => customer.type === "Företag" || customer.type === "Company").length;
  const values = [customers.length, activeCustomers, prospects, companies];
  const icons = [UsersRound, CircleDot, UserRoundSearch, Building2];
  const tones = ["bg-[#e9f2ec] text-[#17452f]", "bg-[#edf0f8] text-[#405582]", "bg-[#f8f0df] text-[#8a6722]", "bg-[#f0ece8] text-[#6d5948]"];
  const stats = copy.stats.map(([label, helper], index) => ({ label, value: String(values[index]), helper, icon: icons[index], tone: tones[index] }));

  return (
    <div className="grid gap-6">
      <DashboardPageHeader eyebrow={copy.eyebrow} title={copy.title} description={copy.description} icon={UsersRound} actions={
        <Link href={withLocale("/dashboard/kunder/ny")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#0f3020]">
          <UserRoundPlus className="h-4 w-4" aria-hidden="true" />{copy.newCustomer}
        </Link>
      } />

      <DashboardMetricGrid items={stats} />

      {customers.length === 0 ? (
        <DashboardDataPanel title={copy.panelTitle} description={copy.emptyDescription} count={0}>
          <div className="p-5 sm:p-6"><div className="rounded-2xl border border-dashed border-[#ced8cc] bg-[#f7f9f6] px-5 py-8 text-center">
            <h3 className="text-lg font-bold text-[#17201a]">{copy.emptyTitle}</h3>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-[#667168]">{copy.emptyText}</p>
            <Link href={withLocale("/dashboard/kunder/ny")} className="mt-5 inline-flex min-h-10 items-center justify-center rounded-xl bg-[#173e2b] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#0f3020]">{copy.addFirst}</Link>
          </div></div>
        </DashboardDataPanel>
      ) : (
        <DashboardDataPanel title={copy.panelTitle} description={copy.panelDescription} count={customers.length}>
          <div className="hidden grid-cols-[1.25fr_0.75fr_1fr_0.8fr_0.75fr_1fr_1.1fr] gap-4 border-b border-[#e5e9e2] bg-[#f7f9f6] px-6 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#778179] lg:grid">
            {copy.columns.map((column) => <span key={column}>{column}</span>)}
          </div>
          {customers.map((customer) => {
            const nextStep = copy.nextStep[customer.status] ?? copy.nextStep.prospect;
            const profileHref = withLocale(`/dashboard/kunder/${customer.id}`);
            return <div key={customer.id} className="mx-3 my-3 grid gap-3 rounded-2xl border border-[#e2e7df] bg-white p-4 text-sm text-[#435047] shadow-sm lg:mx-0 lg:my-0 lg:grid-cols-[1.25fr_0.75fr_1fr_0.8fr_0.75fr_1fr_1.1fr] lg:items-center lg:gap-4 lg:rounded-none lg:border-x-0 lg:border-t-0 lg:px-6 lg:py-4 lg:shadow-none lg:last:border-b-0">
              {[customer.name, customer.type, customer.service, customer.city].map((value, index) => <div key={copy.columns[index]}><p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] lg:hidden">{copy.columns[index]}</p><p className={index === 0 ? "font-semibold text-[#17201a]" : undefined}>{value}</p></div>)}
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] lg:hidden">{copy.columns[4]}</p><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[customer.status] ?? statusStyles.active}`}>{copy.statusLabels[customer.status] ?? customer.status}</span></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] lg:hidden">{copy.columns[5]}</p><p className="font-semibold text-[#17452f]">{nextStep}</p></div>
              <div><p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] lg:hidden">{copy.columns[6]}</p><Link href={profileHref} className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[#173e2b] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#0f3020]">{copy.viewProfile}</Link></div>
            </div>;
          })}
        </DashboardDataPanel>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-[24px] bg-[#173e2b] p-6 text-white shadow-[0_14px_36px_rgba(20,43,32,0.12)] md:col-span-2"><h3 className="text-xl font-bold">{copy.relationshipTitle}</h3><p className="mt-2 max-w-2xl text-sm leading-7 text-white/80">{copy.relationshipText}</p></article>
        <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-sm"><p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">{copy.customerWork}</p><h3 className="mt-2 text-xl font-bold text-[#17201a]">{copy.moreData}</h3><p className="mt-2 text-sm leading-7 text-[#5b665f]">{copy.moreDataText}</p></article>
      </section>
    </div>
  );
}
