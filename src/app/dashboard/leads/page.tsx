import Link from "next/link";
import { Bot, CalendarPlus, LayoutList, UserRoundPlus, UserRoundSearch } from "lucide-react";

import { DashboardDataPanel, DashboardMetricGrid, DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getDashboardLeads, type DashboardLead } from "@/lib/dashboard-leads";
import { hasDashboardModuleAccess } from "@/lib/workspace-module-access";

export const dynamic = "force-dynamic";

type LeadStatus = DashboardLead["status"];

const statusStyles: Record<LeadStatus, string> = {
  Ny: "bg-[#e7f1eb] text-[#17452f]",
};

function getLeadStats(leads: DashboardLead[]) {
  const aiChatLeads = leads.filter((lead) => lead.source === "AI-chatt").length;
  const dashboardLeads = leads.filter((lead) => lead.source === "Dashboard").length;

  return [
    { label: "Nya leads", value: String(leads.length), helper: "Prospekt som behöver uppföljning", icon: UserRoundSearch, tone: "bg-[#e9f2ec] text-[#17452f]" },
    { label: "AI-chatt", value: String(aiChatLeads), helper: "Inkomna från AI-dialogen", icon: Bot, tone: "bg-[#edf0f8] text-[#405582]" },
    { label: "Dashboard", value: String(dashboardLeads), helper: "Manuellt skapade prospekt", icon: LayoutList, tone: "bg-[#f8f0df] text-[#8a6722]" },
    { label: "Bokning föreslagen", value: "0", helper: "Redo för kommande bokningssteg", icon: CalendarPlus, tone: "bg-[#f0ece8] text-[#6d5948]" },
  ];
}

export default async function LeadsPage() {
  const [leads, canUseCrm, canUseBooking] = await Promise.all([
    getDashboardLeads(),
    hasDashboardModuleAccess("customer_crm"),
    hasDashboardModuleAccess("online_booking"),
  ]);
  const stats = getLeadStats(leads);

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow="Leads"
        title="Hantera nya kundförfrågningar"
        description={canUseCrm
          ? "Samla inkommande förfrågningar, prioritera nästa kontakt och konvertera intresset till kund eller bokning."
          : "Samla inkommande förfrågningar och prioritera nästa kontakt. Kundprofiler och full CRM-historik ingår i Professional."}
        icon={UserRoundSearch}
        actions={
          <>
            {canUseCrm ? <Link href="/dashboard/kunder/ny" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-[#0f3020]">
              <UserRoundPlus className="h-4 w-4" aria-hidden="true" />
              Ny kund
            </Link> : null}
            {canUseBooking ? <Link href="/dashboard/bokningar/ny" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d5ddd3] bg-white px-4 py-2.5 text-sm font-bold text-[#17452f] transition hover:-translate-y-0.5 hover:bg-[#f3f6f2]">
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              Ny bokning
            </Link> : null}
          </>
        }
      />

      <DashboardMetricGrid items={stats} />

      <DashboardDataPanel
        title="Aktiva förfrågningar"
        description={canUseCrm ? "Prioriterad arbetslista med prospekt från kundregistret." : "Prioriterad arbetslista med inkommande förfrågningar."}
        count={leads.length}
      >
        {leads.length === 0 ? (
          <div className="p-5 sm:p-6">
            <div className="rounded-2xl border border-dashed border-[#ced8cc] bg-[#f7f9f6] px-5 py-8 text-center text-sm leading-7 text-[#667168]">
              {canUseCrm ? "Inga aktiva leads hittades. Skapa en kund med status Prospekt så visas den här." : "Inga aktiva leads hittades. Nya förfrågningar visas här när de kommer in."}
            </div>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-[0.7fr_1.2fr_1fr_0.8fr_0.7fr_0.8fr_0.7fr_1fr_1.4fr] gap-4 border-b border-[#e5e9e2] bg-[#f7f9f6] px-6 py-3 text-[10px] font-bold uppercase tracking-[0.1em] text-[#778179] xl:grid">
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
              <div key={lead.id} className="mx-3 my-3 grid gap-3 rounded-2xl border border-[#e2e7df] bg-white p-4 text-sm text-[#435047] shadow-sm last:border-b xl:mx-0 xl:my-0 xl:grid-cols-[0.7fr_1.2fr_1fr_0.8fr_0.7fr_0.8fr_0.7fr_1fr_1.4fr] xl:items-center xl:gap-4 xl:rounded-none xl:border-x-0 xl:border-t-0 xl:px-6 xl:py-4 xl:shadow-none xl:last:border-b-0">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] xl:hidden">Ref</p>
                  <p className="font-semibold text-[#17201a]">{lead.ref}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] xl:hidden">Kund</p>
                  <p className="font-semibold text-[#17201a]">{lead.customer}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] xl:hidden">Tjänst</p>
                  <p>{lead.service}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] xl:hidden">Ort</p>
                  <p>{lead.city}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] xl:hidden">Status</p>
                  <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[lead.status]}`}>
                    {lead.status}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] xl:hidden">Källa</p>
                  <p>{lead.source}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] xl:hidden">Värde</p>
                  <p>{lead.value}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] xl:hidden">Nästa steg</p>
                  <p className="font-semibold text-[#17452f]">{lead.nextStep}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#8a948d] xl:hidden">Åtgärd</p>
                  <div className="flex flex-wrap gap-2">
                    {canUseCrm ? <Link
                      href={lead.profileHref}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[#173e2b] px-3 py-2 text-xs font-bold text-white transition hover:bg-[#0f3020]"
                    >
                      Visa profil
                    </Link> : null}
                    {canUseBooking ? <Link
                      href={lead.bookingHref}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-[#cfdbd1] bg-white px-3 py-2 text-xs font-bold text-[#17452f] transition hover:bg-[#f1f5f2]"
                    >
                      Bokning
                    </Link> : null}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </DashboardDataPanel>
    </div>
  );
}
