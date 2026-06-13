const leads = [
  {
    ref: "PRO-DEMO-001",
    customer: "Anna Karlsson",
    service: "Hemstädning",
    city: "Södertälje",
    status: "Ny",
    source: "Webbformulär",
    value: "1 490 kr",
    nextStep: "Ring kund",
  },
  {
    ref: "PRO-DEMO-002",
    customer: "Nordic Kontor AB",
    service: "Kontorsstädning",
    city: "Stockholm",
    status: "Kontaktad",
    source: "AI-chatt",
    value: "Offert",
    nextStep: "Skicka förslag",
  },
  {
    ref: "PRO-DEMO-003",
    customer: "Bostadsservice Demo",
    service: "Flyttstädning",
    city: "Tumba",
    status: "Bokning föreslagen",
    source: "QR-kod",
    value: "3 900 kr",
    nextStep: "Bekräfta tid",
  },
] as const;

const stats = [
  { label: "Nya leads", value: "12" },
  { label: "Kontaktade", value: "7" },
  { label: "Bokning föreslagen", value: "3" },
  { label: "Snittvärde", value: "2 850 kr" },
] as const;

export default function LeadsPage() {
  return (
    <div className="grid gap-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Leads</p>
        <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Leadhantering</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
          Preview för hur inkommande förfrågningar kan visas med status, källa, uppskattat värde och nästa åtgärd.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {stats.map((item) => (
          <article key={item.label} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="text-sm text-[#5b665f]">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-[#17452f]">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#dfe5dd]">
        <div className="grid grid-cols-7 gap-4 border-b border-[#dfe5dd] bg-[#f7f7f4] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[#344139]">
          <span>Ref</span>
          <span>Kund</span>
          <span>Tjänst</span>
          <span>Ort</span>
          <span>Status</span>
          <span>Värde</span>
          <span>Nästa steg</span>
        </div>
        {leads.map((lead) => (
          <div key={lead.ref} className="grid grid-cols-1 gap-3 border-b border-[#eef1ec] px-5 py-4 text-sm text-[#344139] last:border-0 md:grid-cols-7 md:gap-4">
            <span className="font-semibold text-[#17201a]">{lead.ref}</span>
            <span>{lead.customer}</span>
            <span>{lead.service}</span>
            <span>{lead.city}</span>
            <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f] md:w-fit">{lead.status}</span>
            <span>{lead.value}</span>
            <span>{lead.nextStep}</span>
          </div>
        ))}
      </section>

      <section className="rounded-3xl bg-[#17452f] p-6 text-white">
        <h3 className="text-xl font-bold">Kommande funktion</h3>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-white/80">
          I nästa databasfas kan denna vy kopplas till riktiga leads, statusändringar, påminnelser och automatisk uppföljning.
        </p>
      </section>
    </div>
  );
}
