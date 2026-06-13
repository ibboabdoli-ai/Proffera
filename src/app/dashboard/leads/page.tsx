const leads = [
  { ref: "PRO-DEMO-001", service: "Hemstädning", status: "Ny", source: "Webb" },
  { ref: "PRO-DEMO-002", service: "Fönsterputs", status: "Kontaktad", source: "AI-chatt" },
  { ref: "PRO-DEMO-003", service: "Flyttstädning", status: "Bokning föreslagen", source: "Formulär" },
] as const;

export default function LeadsPage() {
  return (
    <div className="grid gap-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Leads</p>
        <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Leadhantering</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">Preview för hur inkommande förfrågningar kan visas med status, källa och tjänst.</p>
      </section>
      <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-[#dfe5dd]">
        <div className="grid grid-cols-4 gap-4 border-b border-[#dfe5dd] bg-[#f7f7f4] px-5 py-3 text-sm font-semibold text-[#344139]">
          <span>Ref</span><span>Tjänst</span><span>Status</span><span>Källa</span>
        </div>
        {leads.map((lead) => (
          <div key={lead.ref} className="grid grid-cols-4 gap-4 border-b border-[#eef1ec] px-5 py-4 text-sm text-[#344139] last:border-0">
            <span className="font-semibold">{lead.ref}</span><span>{lead.service}</span><span>{lead.status}</span><span>{lead.source}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
