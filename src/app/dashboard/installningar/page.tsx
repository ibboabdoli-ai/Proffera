const settings = [
  { label: "Företagsprofil", value: "Namn, kontakt, orter och öppettider", status: "Grund" },
  { label: "Tjänster", value: "Valbara tjänster, priser och serviceområden", status: "Viktigt" },
  { label: "Notiser", value: "E-post, interna aviseringar och påminnelser", status: "Kommande" },
  { label: "AI-svar", value: "Ton, frågor, svarsmallar och branschkunskap", status: "Kommande" },
] as const;

const formFields = [
  { label: "Företagsnamn", value: "Proffera Demo AB" },
  { label: "Primär ort", value: "Stockholm" },
  { label: "Svarstid mål", value: "Under 10 minuter" },
  { label: "Standard CTA", value: "Boka demo" },
] as const;

export default function SettingsPage() {
  return (
    <div className="grid gap-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Inställningar</p>
        <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Workspace-inställningar</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
          Preview för framtida företagsinställningar i SaaS-delen: profil, tjänster, notifieringar och AI-svar.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="grid gap-4 lg:grid-cols-2">
          {settings.map((setting) => (
            <article key={setting.label} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-bold text-[#17201a]">{setting.label}</p>
                  <p className="mt-2 text-sm leading-6 text-[#5b665f]">{setting.value}</p>
                </div>
                <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">{setting.status}</span>
              </div>
            </article>
          ))}
        </div>

        <aside className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <h3 className="text-xl font-bold text-[#17201a]">Form preview</h3>
          <p className="mt-2 text-sm text-[#5b665f]">Exempel på framtida inställningsformulär.</p>
          <div className="mt-5 space-y-4">
            {formFields.map((field) => (
              <label key={field.label} className="grid gap-2 text-sm font-semibold text-[#344139]">
                {field.label}
                <input className="rounded-2xl border border-[#dfe5dd] bg-[#f7f7f4] px-4 py-3 text-sm font-normal text-[#17201a] outline-none" value={field.value} readOnly />
              </label>
            ))}
          </div>
          <div className="mt-6 rounded-2xl bg-[#17452f] p-4 text-sm leading-6 text-white/85">
            Dessa fält är bara UI-preview. Ingen sparning eller databasanslutning är aktiverad i Phase 17.2.
          </div>
        </aside>
      </section>
    </div>
  );
}
