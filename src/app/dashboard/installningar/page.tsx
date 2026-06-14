import { getDashboardWorkspaceSettings } from "@/lib/workspace-settings-db";

export const dynamic = "force-dynamic";

const settings = [
  { label: "Företagsprofil", value: "Namn, kontakt, ort och CTA", status: "Aktiv" },
  { label: "Tjänster", value: "Valbara tjänster, priser och serviceområden", status: "Kommande" },
  { label: "Notiser", value: "E-post, interna aviseringar och påminnelser", status: "Kommande" },
  { label: "AI-svar", value: "Ton, frågor, svarsmallar och branschkunskap", status: "Kommande" },
] as const;

function visibleValue(value: string) {
  const trimmedValue = value.trim();

  return trimmedValue.length > 0 ? trimmedValue : "Ej angivet";
}

export default async function SettingsPage() {
  const workspaceSettings = await getDashboardWorkspaceSettings();

  const formFields = [
    { label: "Företagsnamn", value: workspaceSettings.companyName },
    { label: "Primär ort", value: workspaceSettings.primaryCity },
    { label: "Svarstid mål", value: workspaceSettings.responseTimeGoal },
    { label: "Standard CTA", value: workspaceSettings.defaultCta },
    { label: "Kontakt e-post", value: visibleValue(workspaceSettings.contactEmail) },
    { label: "Kontakt telefon", value: visibleValue(workspaceSettings.contactPhone) },
  ] as const;

  return (
    <div className="grid gap-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Inställningar</p>
        <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Workspace-inställningar</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
          Read-only vy för företagsprofilen. Data hämtas från workspace_settings i Neon för workspace default.
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
          <h3 className="text-xl font-bold text-[#17201a]">Företagsprofil</h3>
          <p className="mt-2 text-sm text-[#5b665f]">Hämtas från databasen. Ingen sparning är aktiverad ännu.</p>
          <div className="mt-5 space-y-4">
            {formFields.map((field) => (
              <label key={field.label} className="grid gap-2 text-sm font-semibold text-[#344139]">
                {field.label}
                <input className="rounded-2xl border border-[#dfe5dd] bg-[#f7f7f4] px-4 py-3 text-sm font-normal text-[#17201a] outline-none" value={field.value} readOnly />
              </label>
            ))}
          </div>
          <div className="mt-6 rounded-2xl bg-[#17452f] p-4 text-sm leading-6 text-white/85">
            Read-only i Phase 18.15. Nästa steg blir att bygga ett säkert save-flöde separat.
          </div>
        </aside>
      </section>
    </div>
  );
}
