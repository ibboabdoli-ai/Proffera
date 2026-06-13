const settings = [
  { label: "Företagsprofil", value: "Namn, kontakt och orter" },
  { label: "Tjänster", value: "Valbara tjänster och priser" },
  { label: "Notiser", value: "E-post och interna aviseringar" },
  { label: "AI-svar", value: "Ton, frågor och svarsmallar" },
] as const;

export default function SettingsPage() {
  return (
    <div className="grid gap-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Inställningar</p>
        <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Workspace-inställningar</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">Preview för framtida företagsinställningar i SaaS-delen.</p>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        {settings.map((setting) => (
          <article key={setting.label} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="text-lg font-bold text-[#17201a]">{setting.label}</p>
            <p className="mt-2 text-sm text-[#5b665f]">{setting.value}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
