import Link from "next/link";

import { getDashboardLeads, type DashboardLead } from "@/lib/dashboard-leads";

export const dynamic = "force-dynamic";

type LeadStatus = DashboardLead["status"];

const statusStyles: Record<LeadStatus, string> = {
  Ny: "bg-[#e7f1eb] text-[#17452f]",
};

function getLeadStats(leads: DashboardLead[]) {
  const aiChatLeads = leads.filter((lead) => lead.source === "AI-chatt").length;
  const dashboardLeads = leads.filter((lead) => lead.source === "Dashboard").length;

  return [
    { label: "Nya leads", value: String(leads.length), helper: "Prospekt i CRM som behöver uppföljning" },
    { label: "AI-chatt", value: String(aiChatLeads), helper: "Framtida chattleads visas här" },
    { label: "Dashboard", value: String(dashboardLeads), helper: "Manuellt skapade prospekt" },
    { label: "Bokning föreslagen", value: "0", helper: "Aktiveras när leadflödet får bokningssteg" },
  ];
}

export default async function LeadsPage() {
  const leads = await getDashboardLeads();
  const stats = getLeadStats(leads);

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Leads</p>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-[#17201a]">Hantera nya kundförfrågningar</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
              Samla inkommande förfrågningar, prioritera nästa kontakt och konvertera intresset till kund eller bokning. Vyn visar nu prospekt från kund-CRM och är redo för framtida AI-chattleads.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/dashboard/kunder/ny"
              className="inline-flex items-center justify-center rounded-full bg-[#17452f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#123927]"
            >
              Ny kund
            </Link>
            <Link
              href="/dashboard/bokningar/ny"
              className="inline-flex items-center justify-center rounded-full border border-[#17452f] bg-white px-5 py-3 text-sm font-semibold text-[#17452f] transition hover:bg-[#eef5ef]"
            >
              Ny bokning
            </Link>
          </div>
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

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#dfe5dd]">
        <div className="border-b border-[#dfe5dd] px-5 py-4">
          <h3 className="text-lg font-bold text-[#17201a]">Aktiva förfrågningar</h3>
          <p className="mt-1 text-sm text-[#5b665f]">
            Prioriterad arbetslista med prospekt från kundregistret. Kunder med status prospekt visas som leads.
          </p>
        </div>

        {leads.length === 0 ? (
          <div className="px-5 py-8 text-sm leading-7 text-[#5b665f]">
            Inga aktiva leads hittades. Skapa en kund med status Prospekt så visas den här.
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-9 gap-4 border-b border-[#dfe5dd] bg-[#f7f7f4] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#344139] md:grid">
              <span>Ref</span>
              <span>Kund</span>
              <span>Tjänst</span>
              <span>Ort</span>
              <span>Status</span>
              <span>Källa</span>
              <span>Värde</span>
              <span>Nästa steg</span>
              <span>Åtgärd</span>
            </div>

            {leads.map((lead) => (
              <div key={lead.id} className="grid gap-3 border-b border-[#eef1ec] px-5 py-4 text-sm text-[#344139] last:border-0 md:grid-cols-9 md:gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Ref</p>
                  <p className="font-semibold text-[#17201a]">{lead.ref}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Kund</p>
                  <p>{lead.customer}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Tjänst</p>
                  <p>{lead.service}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Ort</p>
                  <p>{lead.city}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Status</p>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[lead.status]}`}>
                    {lead.status}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Källa</p>
                  <p>{lead.source}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Värde</p>
                  <p>{lead.value}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Nästa steg</p>
                  <p className="font-semibold text-[#17452f]">{lead.nextStep}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-[#8a948d] md:hidden">Åtgärd</p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={lead.profileHref}
                      className="inline-flex items-center justify-center rounded-full bg-[#17452f] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#123927]"
                    >
                      Visa profil
                    </Link>
                    <Link
                      href={lead.bookingHref}
                      className="inline-flex items-center justify-center rounded-full border border-[#17452f] bg-white px-3 py-2 text-xs font-semibold text-[#17452f] transition hover:bg-[#eef5ef]"
                    >
                      Bokning
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
