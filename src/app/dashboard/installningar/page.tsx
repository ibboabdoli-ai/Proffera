import { SlidersHorizontal } from "lucide-react";
import { redirect } from "next/navigation";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getDashboardWorkspaceServices } from "@/lib/workspace-services-db";
import { bookingWeekdays, getDashboardWorkspaceBookingHours } from "@/lib/workspace-booking-hours-db";
import { getDashboardWorkspaceSettings } from "@/lib/workspace-settings-db";
import { getModuleAccessLabel } from "@/lib/proffera-modules";
import { getDashboardModuleAccess } from "@/lib/workspace-module-access";
import { getWorkspaceMembers } from "@/lib/workspace-members-db";
import { getPendingWorkspaceMemberInvitations } from "@/features/company/workspace-member-invitation";
import { canManageWorkspaceMembers, canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

import { updateWorkspaceSettingsAction } from "./actions";
import { updateWorkspaceBookingHoursAction } from "./booking-hours-actions";
import { ServicesReadOnly } from "./services-read-only";
import { AccountSecurityCard } from "./account-security-card";
import { WorkspaceMembersCard } from "./workspace-members-card";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  access: "Åtkomstkoden saknas eller är fel. Inga inställningar sparades.",
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

const bookingHoursErrorMessages: Record<string, string> = {
  access: "Åtkomstkoden saknas eller är fel. Bokningstiderna sparades inte.",
  hours: "Kontrollera tiderna. Öppning behöver vara före stängning.",
  save: "Bokningstiderna kunde inte sparas. Försök igen.",
};

const memberErrorMessages: Record<string, string> = {
  access: "Endast arbetsytans Owner kan ändra medlemmar.", invalid: "Kontrollera e-post, roll och vald medlem.",
  not_found: "Ingen befintlig Proffera-användare hittades med den e-postadressen.", exists: "Användaren är redan medlem i arbetsytan.",
  protected: "Owner-medlemskapet är skyddat.", expired: "Inbjudan har gått ut eller är inte längre aktiv.",
  email: "Inbjudan sparades, men e-post kunde inte skickas. Försök skicka igen.", database: "Medlemsändringen kunde inte sparas. Försök igen.",
};

const inputClass =
  "rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/15";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type SettingsPageProps = {
  searchParams?: Promise<{
    error?: string | string[];
    updated?: string | string[];
    service_error?: string | string[];
    service_updated?: string | string[];
    hours_error?: string | string[];
    hours_updated?: string | string[];
    member_error?: string | string[];
    member_updated?: string | string[];
  }>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const access = await getUserWorkspaceAccess();

  if (!canManageWorkspaceSettings(access)) {
    redirect("/dashboard");
  }

  const params = searchParams ? await searchParams : undefined;
  const errorValue = firstParam(params?.error);
  const updatedValue = firstParam(params?.updated);
  const serviceErrorValue = firstParam(params?.service_error);
  const serviceUpdatedValue = firstParam(params?.service_updated);
  const hoursErrorValue = firstParam(params?.hours_error);
  const hoursUpdatedValue = firstParam(params?.hours_updated);
  const memberErrorValue = firstParam(params?.member_error);
  const memberUpdatedValue = firstParam(params?.member_updated);
  const errorMessage = errorValue ? errorMessages[errorValue] : undefined;
  const serviceErrorMessage = serviceErrorValue ? serviceErrorMessages[serviceErrorValue] : undefined;
  const bookingHoursErrorMessage = hoursErrorValue ? bookingHoursErrorMessages[hoursErrorValue] : undefined;
  const memberErrorMessage = memberErrorValue ? memberErrorMessages[memberErrorValue] : undefined;
  const wasUpdated = updatedValue === "1";
  const wasServiceUpdated = serviceUpdatedValue === "1";
  const wereBookingHoursUpdated = hoursUpdatedValue === "1";
  const [workspaceSettings, workspaceServices, bookingHours, moduleAccess, workspaceMembers, pendingInvitations] = await Promise.all([
    getDashboardWorkspaceSettings(),
    getDashboardWorkspaceServices(),
    getDashboardWorkspaceBookingHours(),
    getDashboardModuleAccess(),
    getWorkspaceMembers(),
    getPendingWorkspaceMemberInvitations(),
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
      <DashboardPageHeader
        eyebrow="Inställningar"
        title="Styr företagsprofil och tjänsteutbud"
        description={`Samla uppgifter som påverkar kundflöden, CTA-knappar, tjänster och kommande AI-svar. Aktiv profil: ${workspaceSettings.companyName}, ${workspaceSettings.primaryCity}.`}
        icon={SlidersHorizontal}
      />

      <AccountSecurityCard />

      <WorkspaceMembersCard members={workspaceMembers} invitations={pendingInvitations} canManage={canManageWorkspaceMembers(access)} />

      {memberUpdatedValue ? <section className="rounded-2xl bg-[#eef8f0] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#c9e6d0]" role="status">Teamets åtkomst uppdaterades.</section> : null}
      {memberErrorMessage ? <section className="rounded-2xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]" role="alert">{memberErrorMessage}</section> : null}

      {wasUpdated ? (
        <section className="rounded-2xl bg-[#eef8f0] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#c9e6d0]">
          Företagsprofilen sparades.
        </section>
      ) : null}

      {wasServiceUpdated ? (
        <section className="rounded-2xl bg-[#eef8f0] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#c9e6d0]">
          Tjänsten sparades.
        </section>
      ) : null}

      {wereBookingHoursUpdated ? (
        <section className="rounded-2xl bg-[#eef8f0] p-5 text-sm font-semibold text-[#17452f] ring-1 ring-[#c9e6d0]">
          Bokningstiderna sparades och används nu på din bokningssida.
        </section>
      ) : null}

      {errorMessage ? (
        <section className="rounded-2xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">
          {errorMessage}
        </section>
      ) : null}

      {serviceErrorMessage ? (
        <section className="rounded-2xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">
          {serviceErrorMessage}
        </section>
      ) : null}

      {bookingHoursErrorMessage ? (
        <section className="rounded-2xl bg-[#fff5f2] p-5 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">
          {bookingHoursErrorMessage}
        </section>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <div className="grid gap-6">
          <div className="grid gap-4 lg:grid-cols-2">
            {settings.map((setting) => (
              <article key={setting.label} className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]">
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

          <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xl font-bold text-[#17201a]">Proffera-moduler</h3>
                <p className="mt-2 text-sm leading-6 text-[#5b665f]">
                  Här ser du vilka moduler som är aktiva för din arbetsyta. Betalning och ändring av plan hanteras av Proffera.
                </p>
              </div>
              <span className="w-fit rounded-full bg-[#f7f7f4] px-3 py-1 text-xs font-semibold text-[#5b665f]">Read-only</span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {moduleAccess.map((module) => (
                <div key={module.id} className="rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold text-[#17201a]">{module.name}</p>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${module.accessState === "active" ? "bg-[#e7f1eb] text-[#17452f]" : module.accessState === "locked" ? "bg-[#f1f2ef] text-[#5b665f]" : "bg-[#fdf1d4] text-[#805d14]"}`}>
                      {getModuleAccessLabel(module.accessState)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[#5b665f]">{module.description}</p>
                  {module.isLocked ? <p className="mt-2 text-xs font-semibold text-[#5b665f]">Inte aktiverad för den här arbetsytan.</p> : null}
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]">
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
                <div key={item.label} className="rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#5b665f]">{item.label}</p>
                  <p className="mt-1 text-sm font-bold text-[#17201a]">{item.value}</p>
                </div>
              ))}
            </div>
          </article>
        </div>

        <aside className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]">
          <h3 className="text-xl font-bold text-[#17201a]">Redigera företagsprofil</h3>
          <p className="mt-2 text-sm leading-6 text-[#5b665f]">
            Uppdatera de uppgifter som kunder och interna flöden ska se först.
          </p>

          <form action={updateWorkspaceSettingsAction} className="mt-5 space-y-4">
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

            <label className="grid gap-2 text-sm font-semibold text-[#344139]">
              Länk för onlinebokning
              <input name="public_booking_slug" type="text" maxLength={60} pattern="[a-z0-9-]+" className={inputClass} placeholder="Ex. iboren" />
              <span className="text-xs font-normal text-[#5b665f]">Din länk blir proffera.se/boka/ditt-namn</span>
            </label>

            <div className="rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm leading-6 text-[#5b665f]">
              <strong className="text-[#17201a]">Säker ändring:</strong> Endast företagsprofilen uppdateras. Kunddata, leads och bokningar påverkas inte.
            </div>

            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#173e2b] px-6 py-3 text-sm font-semibold !text-white transition hover:bg-[#123824] hover:!text-white focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2"
            >
              Spara ändringar
            </button>
          </form>
        </aside>
      </section>

      <section className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xl font-bold text-[#17201a]">Bokningstider</h3>
            <p className="mt-2 text-sm leading-6 text-[#5b665f]">
              Kunder kan bara skicka bokningsförfrågningar inom dessa tider. {bookingHours.isConfigured ? "Tiderna är publicerade." : "Spara tiderna för att publicera bokning."}
            </p>
          </div>
          <span className="w-fit rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">
            {bookingHours.isConfigured ? "Publicerad" : "Ej publicerad"}
          </span>
        </div>

        <form action={updateWorkspaceBookingHoursAction} className="mt-5 grid gap-3">
          <div className="grid gap-3">
            {bookingWeekdays.map((day) => {
              const hour = bookingHours.hours.find((item) => item.weekday === day.value)!;
              return (
                <fieldset key={day.value} className="grid gap-3 rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 sm:grid-cols-[minmax(110px,1fr)_150px_150px_auto] sm:items-end">
                  <legend className="sr-only">{day.label}</legend>
                  <p className="text-sm font-bold text-[#17201a]">{day.label}</p>
                  <label className="grid gap-1 text-xs font-semibold text-[#5b665f]">Öppnar<input name={`opens_at_${day.value}`} type="time" defaultValue={hour.opensAt} className={inputClass} /></label>
                  <label className="grid gap-1 text-xs font-semibold text-[#5b665f]">Stänger<input name={`closes_at_${day.value}`} type="time" defaultValue={hour.closesAt} className={inputClass} /></label>
                  <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-[#344139]"><input name={`closed_${day.value}`} type="checkbox" defaultChecked={hour.isClosed} className="h-4 w-4 accent-[#17452f]" />Stängt</label>
                </fieldset>
              );
            })}
          </div>
          <div className="rounded-xl border border-[#e4e9e2] bg-[#f7f9f6] p-4 text-sm leading-6 text-[#5b665f]">
            <strong className="text-[#17201a]">Säker ändring:</strong> Endast öppettiderna för onlinebokning uppdateras. Befintliga kunder och bokningar ändras inte.
          </div>
          <button type="submit" className="inline-flex w-full items-center justify-center rounded-xl bg-[#173e2b] px-6 py-3 text-sm font-semibold !text-white transition hover:bg-[#123824] hover:!text-white focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2">Spara bokningstider</button>
        </form>
      </section>

      <ServicesReadOnly services={workspaceServices} />
    </div>
  );
}
