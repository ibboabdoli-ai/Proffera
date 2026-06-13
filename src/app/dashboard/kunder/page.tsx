const customers = [
  {
    name: "Anna Karlsson",
    type: "Privatkund",
    city: "Södertälje",
    status: "Aktiv",
    lastContact: "Idag",
    value: "4 uppdrag",
    notes: "Återkommande hemstädning varannan vecka.",
  },
  {
    name: "Nordic Kontor AB",
    type: "Företag",
    city: "Stockholm",
    status: "Prospekt",
    lastContact: "Igår",
    value: "Offert skickad",
    notes: "Vill jämföra kontorsstädning och fönsterputs.",
  },
  {
    name: "Bostadsservice Demo",
    type: "Företag",
    city: "Tumba",
    status: "Aktiv",
    lastContact: "3 dagar sedan",
    value: "2 öppna leads",
    notes: "Behöver snabb uppföljning på flyttstädning.",
  },
] as const;

const pipeline = [
  { label: "Nya kontakter", value: "8" },
  { label: "Aktiva kunder", value: "21" },
  { label: "Prospekt", value: "14" },
] as const;

export default function CustomersPage() {
  return (
    <div className="grid gap-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Kunder</p>
        <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Kund-CRM</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
          Preview för kundkort, kontaktstatus, enkel historik och uppföljningsinformation.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {pipeline.map((item) => (
          <article key={item.label} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="text-sm text-[#5b665f]">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-[#17452f]">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {customers.map((customer) => (
          <article key={customer.name} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-bold text-[#17201a]">{customer.name}</p>
                <p className="mt-2 text-sm text-[#5b665f]">{customer.type} · {customer.city}</p>
              </div>
              <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">{customer.status}</span>
            </div>
            <div className="mt-5 grid gap-3 rounded-2xl bg-[#f7f7f4] p-4 text-sm text-[#344139]">
              <p><strong>Senaste kontakt:</strong> {customer.lastContact}</p>
              <p><strong>Värde:</strong> {customer.value}</p>
              <p><strong>Notering:</strong> {customer.notes}</p>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
