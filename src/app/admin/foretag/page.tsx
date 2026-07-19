import { Building2, CalendarDays, ChevronLeft, CircleAlert, ExternalLink, Mail, MapPin, Phone, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { getCompanyRows, getWorkspaceCompanyRows } from "@/features/company/list";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ invite?: string | string[]; access?: string | string[] }>;
};

const statusStyle: Record<string, string> = {
  active: "bg-[#e7f1eb] text-[#17452f]",
  trial: "bg-[#eef2ff] text-[#4054a4]",
  approved: "bg-[#e7f1eb] text-[#17452f]",
  pending: "bg-[#fdf1d4] text-[#805d14]",
  rejected: "bg-[#fff0ee] text-[#9a3024]",
  paused: "bg-[#eef0ed] text-[#536057]",
  cancelled: "bg-[#fff0ee] text-[#9a3024]",
};

const invitationErrorMessages: Record<string, string> = {
  invalid: "Företaget måste vara godkänt innan en inbjudan kan skickas.",
  email_configuration: "Inbjudan sparades, men Brevo är inte konfigurerat. Kontrollera BREVO_API_KEY och LEAD_FROM_EMAIL i Vercel.",
  email_provider: "Inbjudan sparades, men Brevo avvisade meddelandet. Kontrollera avsändaren och Brevo-loggen.",
  email_network: "Inbjudan sparades, men Proffera kunde inte kontakta Brevo. Försök igen om en stund.",
  database: "Inbjudan kunde inte sparas i databasen. Kontrollera migrationerna och försök igen.",
};

export default async function Page({ searchParams }: PageProps) {
  const [workspaceResult, result, params] = await Promise.all([
    getWorkspaceCompanyRows(),
    getCompanyRows(),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  const workspaces = workspaceResult.rows;
  const companies = result.rows;
  const pendingCount = companies.filter((company) => company.status === "pending").length;
  const inviteValue = Array.isArray(params?.invite) ? params?.invite[0] : params?.invite;
  const accessValue = Array.isArray(params?.access) ? params?.access[0] : params?.access;

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#17452f] transition hover:bg-[#e7f1eb] focus:outline-none focus:ring-4 focus:ring-[#17452f]/10" href="/admin">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Till admin
        </Link>

        <div className="mt-6 flex flex-col gap-5 rounded-[1.75rem] bg-[#102a1c] p-7 text-white shadow-xl shadow-[#17452f]/10 sm:p-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Proffera admin</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Företag och kundkonton</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">Se alla skapade arbetsytor och hantera nya företag som vill börja använda Proffera.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 px-5 py-4 ring-1 ring-white/15">
              <p className="text-sm font-medium text-white/70">Kundkonton</p>
              <p className="mt-1 text-3xl font-bold">{workspaces.length}</p>
            </div>
            <div className="rounded-2xl bg-white/10 px-5 py-4 ring-1 ring-white/15">
              <p className="text-sm font-medium text-white/70">Att följa upp</p>
              <p className="mt-1 text-3xl font-bold">{pendingCount}</p>
            </div>
          </div>
        </div>

        {!workspaceResult.ok ? (
          <div className="mt-6 flex gap-3 rounded-2xl border border-[#e7b8b1] bg-[#fff4f2] p-5 text-[#8a2b20]">
            <CircleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
            <p>{workspaceResult.message}</p>
          </div>
        ) : null}

        {!result.ok ? (
          <div className="mt-6 flex gap-3 rounded-2xl border border-[#e7b8b1] bg-[#fff4f2] p-5 text-[#8a2b20]">
            <CircleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
            <p>{result.message}</p>
          </div>
        ) : null}

        {inviteValue === "sent" ? (
          <p className="mt-6 rounded-2xl border border-[#b8d9c2] bg-[#eef8f0] p-5 text-sm font-semibold text-[#17452f]" role="status">
            Inbjudan skickades. Länken gäller i 48 timmar.
          </p>
        ) : null}

        {inviteValue && inviteValue !== "sent" ? (
          <p className="mt-6 rounded-2xl border border-[#e7b8b1] bg-[#fff4f2] p-5 text-sm font-semibold text-[#8a2b20]" role="alert">
            {invitationErrorMessages[inviteValue] ?? "Inbjudan kunde inte skickas. Kontrollera uppgifterna och försök igen."}
          </p>
        ) : null}

        {accessValue === "updated" ? (
          <p className="mt-6 rounded-2xl border border-[#b8d9c2] bg-[#eef8f0] p-5 text-sm font-semibold text-[#17452f]" role="status">
            Plan och modulåtkomst sparades.
          </p>
        ) : null}

        {accessValue && accessValue !== "updated" ? (
          <p className="mt-6 rounded-2xl border border-[#e7b8b1] bg-[#fff4f2] p-5 text-sm font-semibold text-[#8a2b20]" role="alert">
            Plan och modulåtkomst kunde inte sparas. Kontrollera arbetsytan och försök igen.
          </p>
        ) : null}

        <section className="mt-10">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#5f7568]">Arbetsytor</p>
            <h2 className="mt-2 text-2xl font-bold text-[#17201a]">Aktiva kundkonton</h2>
            <p className="mt-2 text-sm text-[#5b665f]">Alla företag som har en skapad arbetsyta i Proffera visas här.</p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {workspaces.map((workspace) => (
              <article key={workspace.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
                <div className="flex items-start justify-between gap-4 border-b border-[#e5eae4] pb-5">
                  <div className="flex min-w-0 gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e7f1eb] text-[#17452f]"><Building2 className="h-5 w-5" aria-hidden="true" /></div>
                    <div className="min-w-0">
                      <h3 className="truncate text-xl font-bold text-[#17201a]">{workspace.company_name}</h3>
                      <p className="mt-1 truncate text-sm text-[#5b665f]">{workspace.slug}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${statusStyle[workspace.status] ?? statusStyle.paused}`}>{workspace.status}</span>
                </div>

                <div className="mt-5 grid gap-3 text-sm text-[#405047]">
                  <p className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-[#17452f]" aria-hidden="true" />{workspace.primary_city ?? "Ort saknas"}</p>
                  <p className="flex gap-2"><Mail className="h-4 w-4 shrink-0 text-[#17452f]" aria-hidden="true" />{workspace.contact_email ?? "E-post saknas"}</p>
                  <p className="flex gap-2"><Phone className="h-4 w-4 shrink-0 text-[#17452f]" aria-hidden="true" />{workspace.contact_phone ?? "Telefon saknas"}</p>
                  <p className="flex gap-2"><Users className="h-4 w-4 shrink-0 text-[#17452f]" aria-hidden="true" />{workspace.member_count} användare</p>
                  <p className="flex gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-[#17452f]" aria-hidden="true" />Plan: {workspace.plan_key ?? "saknas"}{workspace.plan_status ? ` · ${workspace.plan_status}` : ""}</p>
                </div>

                <form action="/api/company-admin" method="post" className="mt-5 rounded-2xl bg-[#f7f9f6] p-4 ring-1 ring-[#dfe5dd]">
                  <input name="action" type="hidden" value="workspace_access" />
                  <input name="workspace_id" type="hidden" value={workspace.id} />
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[#17201a]">Plan och moduler</p>
                      <p className="mt-1 text-xs leading-5 text-[#667168]">Ändringen gäller bara den här arbetsytan.</p>
                    </div>
                    <ShieldCheck className="h-5 w-5 shrink-0 text-[#17452f]" aria-hidden="true" />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-xs font-semibold text-[#405047]">
                      Plan
                      <select name="plan_key" defaultValue={workspace.plan_key ?? "starter"} className="min-h-11 rounded-xl border border-[#cfd8cf] bg-white px-3 text-sm text-[#17201a] outline-none focus:border-[#17452f] focus:ring-4 focus:ring-[#17452f]/10">
                        <option value="starter">Starter</option>
                        <option value="professional">Professional</option>
                        <option value="business">Business</option>
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-xs font-semibold text-[#405047]">
                      Planstatus
                      <select name="plan_status" defaultValue={workspace.plan_status ?? "trialing"} className="min-h-11 rounded-xl border border-[#cfd8cf] bg-white px-3 text-sm text-[#17201a] outline-none focus:border-[#17452f] focus:ring-4 focus:ring-[#17452f]/10">
                        <option value="trialing">Trial</option>
                        <option value="active">Aktiv</option>
                        <option value="paused">Pausad</option>
                        <option value="past_due">Betalning saknas</option>
                        <option value="cancelled">Avslutad</option>
                      </select>
                    </label>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#667168]">Pausad, avslutad eller obetald plan låser modulerna även om de är markerade.</p>

                  <fieldset className="mt-4 grid gap-2">
                    <legend className="text-xs font-bold uppercase tracking-wide text-[#667168]">Aktiva moduler</legend>
                    <label className="flex min-h-11 items-center gap-3 rounded-xl bg-white px-3 text-sm font-semibold text-[#28362d] ring-1 ring-[#dfe5dd]">
                      <input name="booking_enabled" type="checkbox" defaultChecked={workspace.booking_enabled} className="h-4 w-4 accent-[#17452f]" />
                      Onlinebokning och QR
                    </label>
                    <label className="flex min-h-11 items-center gap-3 rounded-xl bg-white px-3 text-sm font-semibold text-[#28362d] ring-1 ring-[#dfe5dd]">
                      <input name="crm_enabled" type="checkbox" defaultChecked={workspace.crm_customers_enabled && workspace.lead_inbox_enabled} className="h-4 w-4 accent-[#17452f]" />
                      Kund-CRM och Leads
                    </label>
                    <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl bg-[#f2f3f0] px-3 text-sm font-semibold text-[#667168] ring-1 ring-[#dfe5dd]">
                      <span>AI-assistent</span><span className="text-[10px] font-bold uppercase tracking-wide">Planerad</span>
                    </div>
                  </fieldset>

                  <button className="mt-4 min-h-11 w-full rounded-xl bg-[#17452f] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#123724] focus:outline-none focus:ring-4 focus:ring-[#17452f]/20" type="submit">Spara åtkomst</button>
                </form>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#e5eae4] pt-5">
                  <p className="text-xs text-[#6b766e]">Skapad {new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium" }).format(new Date(workspace.created_at))}</p>
                  {workspace.public_booking_slug ? (
                    <Link className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#cfd8cf] px-4 py-2 text-sm font-semibold text-[#17452f] transition hover:bg-[#eef5ef] focus:outline-none focus:ring-4 focus:ring-[#17452f]/10" href={`/boka/${workspace.public_booking_slug}`} target="_blank">
                      Bokningssida <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span className="text-xs font-semibold text-[#805d14]">Bokningslänk ej publicerad</span>
                  )}
                </div>
              </article>
            ))}
          </div>

          {workspaceResult.ok && workspaces.length === 0 ? (
            <div className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-[#dfe5dd]">
              <Building2 className="mx-auto h-8 w-8 text-[#6b766e]" aria-hidden="true" />
              <h3 className="mt-4 text-xl font-bold text-[#17201a]">Inga kundkonton ännu</h3>
              <p className="mt-2 text-sm text-[#5b665f]">När en arbetsyta skapas visas företaget här.</p>
            </div>
          ) : null}
        </section>

        <section className="mt-12">
          <div className="mb-5">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#5f7568]">Registreringar</p>
            <h2 className="mt-2 text-2xl font-bold text-[#17201a]">Nya företagsförfrågningar</h2>
            <p className="mt-2 text-sm text-[#5b665f]">Dessa företag har skickat en förfrågan men är inte automatiskt ett aktivt kundkonto.</p>
          </div>

          <div className="grid gap-5">
          {companies.map((company) => (
            <article key={company.id} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd] sm:p-7">
              <div className="flex flex-col gap-4 border-b border-[#e5eae4] pb-5 md:flex-row md:items-start md:justify-between">
                <div className="flex gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e7f1eb] text-[#17452f]"><Building2 className="h-5 w-5" aria-hidden="true" /></div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-bold text-[#17201a]">{company.company_name}</h2>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyle[company.status] ?? statusStyle.pending}`}>{company.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-[#5b665f]">{company.reference_id} · Org.nr {company.organization_number}</p>
                  </div>
                </div>
                <p className="text-sm text-[#5b665f]">{new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium" }).format(new Date(company.created_at))}</p>
              </div>

              <div className="grid gap-6 pt-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4 text-sm leading-6 text-[#405047]">
                  <p><span className="font-semibold text-[#17201a]">Önskar se:</span> {company.services}</p>
                  <p><span className="font-semibold text-[#17201a]">Arbetsområde:</span> {company.city} · {company.service_areas}</p>
                  <p><span className="font-semibold text-[#17201a]">Behov:</span> {company.description}</p>
                </div>
                <div className="rounded-2xl bg-[#fbfbf8] p-4 text-sm text-[#405047] ring-1 ring-[#e1e7e0]">
                  <p className="font-semibold text-[#17201a]">Kontakt</p>
                  <p className="mt-3 flex gap-2"><Mail className="h-4 w-4 shrink-0 text-[#17452f]" aria-hidden="true" />{company.contact_person} · {company.email}</p>
                  <p className="mt-2 flex gap-2"><Phone className="h-4 w-4 shrink-0 text-[#17452f]" aria-hidden="true" />{company.phone}</p>
                  <p className="mt-2 flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-[#17452f]" aria-hidden="true" />{company.city}</p>
                </div>
              </div>

              <form action="/api/company-admin" method="post" className="mt-6 flex flex-col gap-3 border-t border-[#e5eae4] pt-5 sm:flex-row sm:items-center sm:justify-between">
                <input name="id" type="hidden" value={company.id} />
                <p className="flex items-center gap-2 text-xs leading-5 text-[#6b766e]"><ShieldCheck className="h-4 w-4 shrink-0 text-[#17452f]" aria-hidden="true" />Ändringen sparas direkt med skyddad adminåtkomst.</p>
                <div className="flex flex-wrap gap-2">
                  {company.status === "approved" ? (
                    <button className="min-h-10 rounded-xl bg-[#17452f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#123724] focus:outline-none focus:ring-4 focus:ring-[#17452f]/20" name="action" type="submit" value="invite">Skicka inbjudan</button>
                  ) : null}
                  <button className="min-h-10 rounded-xl bg-[#17452f] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#123724] focus:outline-none focus:ring-4 focus:ring-[#17452f]/20" name="status" type="submit" value="approved">Godkänn</button>
                  <button className="min-h-10 rounded-xl border border-[#cfd8cf] bg-white px-4 py-2 text-sm font-semibold text-[#344139] transition hover:border-[#17452f] focus:outline-none focus:ring-4 focus:ring-[#17452f]/10" name="status" type="submit" value="pending">Följ upp</button>
                  <button className="min-h-10 rounded-xl border border-[#e4c6c1] bg-white px-4 py-2 text-sm font-semibold text-[#8a2b20] transition hover:bg-[#fff4f2] focus:outline-none focus:ring-4 focus:ring-[#8a2b20]/10" name="status" type="submit" value="rejected">Avslå</button>
                </div>
              </form>
            </article>
          ))}
          {result.ok && companies.length === 0 ? (
            <section className="rounded-3xl bg-white p-10 text-center shadow-sm ring-1 ring-[#dfe5dd]">
              <Building2 className="mx-auto h-8 w-8 text-[#6b766e]" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-bold text-[#17201a]">Inga demoförfrågningar ännu</h2>
              <p className="mt-2 text-sm text-[#5b665f]">Nya förfrågningar från Demo och Kontakt visas här.</p>
            </section>
          ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
