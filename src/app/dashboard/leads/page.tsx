import Link from "next/link";

const leads = [
  {
    ref: "LEAD-001",
    customer: "Anna Karlsson",
    service: "Hemstädning",
    city: "Södertälje",
    status: "Ny",
    source: "Webbformulär",
    value: "1 490 kr",
    nextStep: "Ring kund",
  },
  {
    ref: "LEAD-002",
    customer: "Nordic Kontor AB",
    service: "Kontorsstädning",
    city: "Stockholm",
    status: "Kontaktad",
    source: "AI-chatt",
    value: "Offert",
    nextStep: "Skicka förslag",
  },
  {
    ref: "LEAD-003",
    customer: "Bostadsservice AB",
    service: "Flyttstädning",
    city: "Tumba",
    status: "Bokning föreslagen",
    source: "QR-kod",
    value: "3 900 kr",
    nextStep: "Bekräfta tid",
  },
] as const;

const stats = [
  { label: "Nya leads", value: "12", helper: "Kräver första kontakt" },
  { label: "Kontaktade", value: "7", helper: "Väntar på svar eller offert" },
  { label: "Bokning föreslagen", value: "3", helper: "Nästa steg är bekräftelse" },
  { label: "Snittvärde", value: "2 850 kr", helper: "Beräknat värde per förfrågan" },
] as const;

type LeadStatus = (typeof leads)[number]["status"];

const statusStyles: Record<LeadStatus, string> = {
  Ny: "bg-[#e7f1eb] text-[#17452f]",
  Kontaktad: "bg-[#fff4d7] text-[#6f4f00]",
  "Bokning föreslagen": "bg-[#e7edf8] text-[#1f3f6f]",
};

export default function LeadsPage() {
  return (
    <div className="grid gap-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Leads</p>
        <div className="mt-3 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-[#17201a]">Hantera nya kundförfrågningar</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
              Samla inkommande förfrågningar, prioritera nästa kontakt och konvertera intresset till kund eller bokning. Vyn är byggd för snabb uppföljning från webbformulär, AI-chatt och QR-flöden.
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
          <p className="mt-1 text-sm text-[#5b665f]">Prioriterad arbetslista med status, källa, uppskattat värde och rekommenderad åtgärd.</p>
        </div>
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
          <div key={lead.ref} className="grid gap-3 border-b border-[#eef1ec] px-5 py-4 text-sm text-[#344139] last:border-0 md:grid-cols-9 md:gap-4">
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
                  href="/dashboard/kunder/ny"
                  className="inline-flex items-center justify-center rounded-full bg-[#17452f] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#123927]"
                >
                  Skapa kund
                </Link>
                <Link
                  href="/dashboard/bokningar/ny"
                  className="inline-flex items-center justify-center rounded-full border border-[#17452f] bg-white px-3 py-2 text-xs font-semibold text-[#17452f] transition hover:bg-[#eef5ef]"
                >
                  Bokning
                </Link>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-3xl bg-[#17452f] p-6 text-white md:col-span-2">
          <h3 className="text-xl font-bold">Från förfrågan till bokad affär</h3>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-white/80">
            Börja med nya leads, kontakta kunden, skapa kundprofil och föreslå en bokning. Ett tydligt arbetsflöde gör att teamet snabbare ser vem som behöver nästa kontakt.
          </p>
        </article>
        <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Uppföljning</p>
          <h3 className="mt-2 text-xl font-bold text-[#17201a]">Minska tappade affärer</h3>
          <p className="mt-2 text-sm leading-7 text-[#5b665f]">
            Använd nästa steg, källa och värde för att prioritera rätt kontakt och hålla varje förfrågan levande tills den är bokad, vunnen eller avslutad.
          </p>
        </article>
      </section>
    </div>
  );
}
