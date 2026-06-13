const stats = [
  { label: "Nya leads", value: "12", text: "Förfrågningar att följa upp" },
  { label: "Bokningar", value: "5", text: "Planerade kundmöten" },
  { label: "Svarstid", value: "8 min", text: "Mål för snabb återkoppling" },
  { label: "AI-dialoger", value: "24", text: "Samtal från webbplatsen" },
] as const;

const modules = [
  "Leadlista med status",
  "Kundprofiler och historik",
  "Bokningskalender",
  "AI-assistent för frågor",
  "Notiser och bekräftelser",
  "Inställningar för tjänster",
] as const;

export default function DashboardPage() {
  return (
    <div className="grid gap-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Översikt</p>
        <h2 className="mt-2 text-3xl font-bold text-[#17201a]">SaaS dashboard shell</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
          Detta är en första dashboard-grund för Proffera som produkt. Den är separat från nuvarande adminflöde och ska byggas vidare steg för steg.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <article key={item.label} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="text-sm font-semibold text-[#5b665f]">{item.label}</p>
            <p className="mt-3 text-3xl font-bold text-[#17452f]">{item.value}</p>
            <p className="mt-2 text-sm text-[#5b665f]">{item.text}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
        <h3 className="text-xl font-bold text-[#17201a]">Planerade moduler</h3>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((module) => (
            <div key={module} className="rounded-2xl bg-[#f7f7f4] px-4 py-3 text-sm font-semibold text-[#344139]">
              {module}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
