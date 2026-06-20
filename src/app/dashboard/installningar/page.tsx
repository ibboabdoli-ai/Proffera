import { getDashboardWorkspaceServices } from "@/lib/workspace-services-db";
import { getDashboardWorkspaceSettings } from "@/lib/workspace-settings-db";
import { profferaModules } from "@/lib/proffera-modules";

import { updateWorkspaceSettingsAction } from "./actions";
import { ServicesReadOnly } from "./services-read-only";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  access: "Åtkomstkoden saknas eller är fel. Inga inställningar sparades.",
  disabled: "Sparning är inte aktiverad ännu. Kontrollera den interna åtkomstkoden och miljöinställningen.",
  company: "Företagsnamn är obligatoriskt och får vara max 160 tecken.",
  city: "Primär ort är obligatorisk och får vara max 120 tecken.",
  response: "Svarstid mål är obligatoriskt och får vara max 120 tecken.",
  cta: "Standard CTA är obligatorisk och får vara max 80 tecken.",
  email: "Kontakt e-post behöver vara tom eller en giltig e-postadress på max 180 tecken.",
  phone: "Kontakt telefon får vara max 80 tecken.",
  save: "Företagsprofilen kunde inte sparas. Kontrollera inställningarna och försök igen.",
};

const serviceErrorMessages: Record<string, string> = {
  access: "Åtkomstkoden saknas eller är fel. Tjänsten sparades inte.",
  disabled: "Sparning av tjänster är inte aktiverad ännu.",
  id: "Tjänsten kunde inte hittas.",
  name: "Namn är obligatoriskt och får vara max 140 tecken.",
  description: "Beskrivning får vara max 500 tecken.",
  category: "Kategori får vara max 120 tecken.",
  price: "Prisvisning får vara max 120 tecken.",
  base_price: "Baspris behöver vara ett heltal från 0 och uppåt.",
  duration: "Längd behöver vara 1-1440 minuter.",
  area: "Område får vara max 240 tecken.",
  sort: "Sortering behöver vara ett heltal mellan 0 och 9999.",
  save: "Tjänsten kunde inte sparas. Kontrollera uppgifterna och försök igen.",
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
    service_error?: string | string[];
    service_updated?: string | string[];
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const errorValue = firstParam(params?.error);
  const updatedValue = firstParam(params?.updated);
  const serviceErrorValue = firstParam(params?.service_error);
  const serviceUpdatedValue = firstParam(params?.service_updated);
  const errorMessage = errorValue ? errorMessages[errorValue] : undefined;
  const serviceErrorMessage = serviceErrorValue ? serviceErrorMessages[serviceErrorValue] : undefined;
  const wasUpdated = updatedValue === "1";
  const wasServiceUpdated = serviceUpdatedValue === "1";
  const [workspaceSettings, workspaceServices] = await Promise.all([
    getDashboardWorkspaceSettings(),
    getDashboardWorkspaceServices(),
  ]);
  const hasServices = workspaceServices.length > 0;
  const activeServices = workspaceServices.filter((service) => service.isActive).length;

  const settings = [
    { label: "Företagsprofil", value: "Namn, kontaktuppgifter, ort och standard CTA", status: "Aktiv" },
    {
      label: "Tjänstekatalog",
      value: hasServices ? `${activeServices} aktiva av ${workspaceServices.length} tjänster` : "Lägg in tjänster, priser och serviceområden",
      status: hasServices ? "Aktiv" : "Redo att fyllas i",
    },
    { label: "Notiser", value: "E-post, interna aviseringar och påminnelser", status: "Kommande" },
    { label: "AI-svar", value: "Ton, följdfrågor, svarsmallar och företagskunskap", status: "Kommande" },
  ] as const;

  const profileSummary = [
    { label: "Företag", value: workspaceSettings.companyName || "Ej angivet" },
    { label: "Primär ort", value: workspaceSettings.primaryCity || "Ej angivet" },
    { label: "Svarstid", value: workspaceSettings.responseTimeGoal || "Ej angivet" },
    { label: "Standard CTA", value: workspaceSettings.defaultCta || "Ej angivet" },
  ] as const;

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl bg-[#f7f7f4] p-6 ring-1 ring-[#e4e7df] lg:p-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Inställningar</p>
        <div className="mt-3 grid gap-6 lg:grid-cols-[1.3fr_0.7fr] lg:items-end">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-[#17201a]">Styr företagsprofil och tjänsteutbud</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#5b665f]">
              Samla de uppgifter som påverkar kundflöden, CTA-knappar, tjänster och kommande AI-svar på ett ställe.
              Håll profilen tydlig så att teamet, bokningar och kunddialoger använder samma information.
            </p>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-[#dfe5dd]">
            <p className="text-sm font-semibold text-[#5b665f]">Aktuell profil</p>
            <p className="mt-2 text-2xl font-bold text-[#17201a]">{workspaceSettings.companyName}</p>
            <p className="mt-1 text-sm text-[#5b665f]">{workspaceSettings.primaryCity}</p>
          </div>
        </div>
      </section>

      {wasUpdated ? (
        <section className="rounded-3xl bg-[#eef8f0] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#c9e6d0]">
          Företagsprofilen sparades.
        </section>
      ) : null}

      {wasServiceUpdated ? (
        <section className="rounded-3xl bg-[#eef8f0] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#c9e6d0]">
          Tjänsten sparades.
        </section>
      ) : null}

      {errorMessage ? (
        <section className="rounded-3xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">
          {errorMessage}
        </section>
      ) : null}

      {serviceErrorMessage ? (
        <section className="rounded-3xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">
          {serviceErrorMessage}
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="grid gap-6">
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

          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xl font-bold text-[#17201a]">Proffera-moduler</h3>
                <p className="mt-2 text-sm leading-6 text-[#5b665f]">
                  En intern översikt över produktmodulerna. I nästa steg kan dessa kopplas till access och betalning.
                </p>
              </div>
              <span className="w-fit rounded-full bg-[#f7f7f4] px-3 py-1 text-xs font-semibold text-[#5b665f]">Read-only</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {profferaModules.map((module) => (
                <div key={module.id} className="rounded-2xl bg-[#f7f7f4] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold text-[#17201a]">{module.name}</p>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#17452f]">
                      {module.status === "active" ? "Aktiv" : "Planerad"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#5b665f]">{module.description}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xl font-bold text-[#17201a]">Profil som används i kundflöden</h3>
                <p className="mt-2 text-sm leading-6 text-[#5b665f]">
                  Dessa värden visas i kontaktflöden, påverkar CTA-copy och är grunden för kommande AI-kunddialoger.
                </p>
              </div>
              <span className="w-fit rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">Kundnära data</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {profileSummary.map((item) => (
                <div key={item.label} className="rounded-2xl bg-[#f7f7f4] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#5b665f]">{item.label}</p>
                  <p className="mt-1 text-sm font-bold text-[#17201a]">{item.value}</p>
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
          <h3 className="text-xl font-bold text-[#17201a]">Redigera företagsprofil</h3>
          <p className="mt-2 text-sm leading-6 text-[#5b665f]">
            Uppdatera de uppgifter som kunder och interna flöden ska se först.
          </p>

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
              <strong className="text-[#17201a]">Säker ändring:</strong> Endast företagsprofilen uppdateras. Kunddata, leads och bokningar påverkas inte.
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-full bg-[#17452f] px-6 py-3 text-sm font-semibold !text-white transition hover:bg-[#123824] hover:!text-white focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2"
            >
              Spara ändringar
            </button>
          </form>
        </aside>
      </section>

      <ServicesReadOnly services={workspaceServices} />
    </div>
  );
}
