import { getDashboardWorkspaceSettings } from "@/lib/workspace-settings-db";

import { updateWorkspaceSettingsAction } from "./actions";

export const dynamic = "force-dynamic";

const settings = [
  { label: "Företagsprofil", value: "Namn, kontakt, ort och CTA", status: "Aktiv" },
  { label: "Tjänster", value: "Valbara tjänster, priser och serviceområden", status: "Kommande" },
  { label: "Notiser", value: "E-post, interna aviseringar och påminnelser", status: "Kommande" },
  { label: "AI-svar", value: "Ton, frågor, svarsmallar och branschkunskap", status: "Kommande" },
] as const;

const errorMessages: Record<string, string> = {
  access: "Åtkomstkoden saknas eller är fel. Inga inställningar sparades.",
  disabled: "Sparning är inte aktiverad i miljön. Lägg till DASHBOARD_WRITE_CODE eller ADMIN_ACCESS_CODE.",
  company: "Företagsnamn är obligatoriskt och får vara max 160 tecken.",
  city: "Primär ort är obligatorisk och får vara max 120 tecken.",
  response: "Svarstid mål är obligatoriskt och får vara max 120 tecken.",
  cta: "Standard CTA är obligatorisk och får vara max 80 tecken.",
  email: "Kontakt e-post behöver vara tom eller en giltig e-postadress på max 180 tecken.",
  phone: "Kontakt telefon får vara max 80 tecken.",
  save: "Företagsprofilen kunde inte sparas. Kontrollera Neon-konfigurationen och försök igen.",
};

const inputClass =
  "rounded-2xl border border-[#dfe5dd] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type SettingsPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
    updated?: string | string[];
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const errorValue = firstParam(params?.error);
  const updatedValue = firstParam(params?.updated);
  const errorMessage = errorValue ? errorMessages[errorValue] : undefined;
  const wasUpdated = updatedValue === "1";
  const workspaceSettings = await getDashboardWorkspaceSettings();

  return (
    <div className="grid gap-6">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Inställningar</p>
        <h2 className="mt-2 text-3xl font-bold text-[#17201a]">Workspace-inställningar</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
          Redigera företagsprofilen för workspace default. Sparning kräver intern åtkomstkod och skriver endast till workspace_settings i Neon.
        </p>
      </section>

      {wasUpdated ? (
        <section className="rounded-3xl bg-[#eef8f0] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#c9e6d0]">
          Företagsprofilen sparades.
        </section>
      ) : null}

      {errorMessage ? (
        <section className="rounded-3xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">
          {errorMessage}
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
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
          <p className="mt-2 text-sm text-[#5b665f]">Ändringar sparas till workspace_settings för workspace default.</p>

          <form action={updateWorkspaceSettingsAction} className="mt-5 space-y-4">
            <label className="grid gap-2 text-sm font-semibold text-[#344139]">
              Intern åtkomstkod
              <input name="access_code" type="password" required autoComplete="off" className={inputClass} placeholder="Ange intern kod" />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-[#344139]">
              Företagsnamn
              <input name="company_name" type="text" required maxLength={160} className={inputClass} defaultValue={workspaceSettings.companyName} />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-[#344139]">
              Primär ort
              <input name="primary_city" type="text" required maxLength={120} className={inputClass} defaultValue={workspaceSettings.primaryCity} />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-[#344139]">
              Svarstid mål
              <input name="response_time_goal" type="text" required maxLength={120} className={inputClass} defaultValue={workspaceSettings.responseTimeGoal} />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-[#344139]">
              Standard CTA
              <input name="default_cta" type="text" required maxLength={80} className={inputClass} defaultValue={workspaceSettings.defaultCta} />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-[#344139]">
              Kontakt e-post
              <input name="contact_email" type="email" maxLength={180} className={inputClass} defaultValue={workspaceSettings.contactEmail} placeholder="Ej angivet" />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-[#344139]">
              Kontakt telefon
              <input name="contact_phone" type="tel" maxLength={80} className={inputClass} defaultValue={workspaceSettings.contactPhone} placeholder="Ej angivet" />
            </label>

            <div className="rounded-2xl bg-[#f7f7f4] p-4 text-sm leading-6 text-[#5b665f]">
              <strong className="text-[#17201a]">Säkerhetsgräns:</strong> Denna åtgärd uppdaterar endast företagsprofilen i workspace_settings. Den ändrar inga kunder, bokningar, leads eller publika sidor.
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-[#17452f] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#123824] focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2"
            >
              Spara ändringar
            </button>
          </form>
        </aside>
      </section>
    </div>
  );
}
