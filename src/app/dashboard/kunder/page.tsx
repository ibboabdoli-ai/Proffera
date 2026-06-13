const customers = [
  { name: "Anna Karlsson", type: "Privatkund", city: "Södertälje", status: "Aktiv" },
  { name: "Nordic Kontor AB", type: "Företag", city: "Stockholm", status: "Prospekt" },
  { name: "Bostadsservice Demo", type: "Företag", city: "Tumba", status: "Aktiv" },
] as const;

export default function CustomersPage() {
  return (
    <div className="grid gap-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Kunder</p>
        <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Kund-CRM</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">Preview för kundkort, kontaktstatus och enkel historik.</p>
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        {customers.map((customer) => (
          <article key={customer.name} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="text-lg font-bold text-[#17201a]">{customer.name}</p>
            <p className="mt-2 text-sm text-[#5b665f]">{customer.type} · {customer.city}</p>
            <span className="mt-5 inline-flex rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">{customer.status}</span>
          </article>
        ))}
      </section>
    </div>
  );
}
