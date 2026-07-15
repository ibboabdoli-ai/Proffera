import { Building2, ChevronLeft, CircleAlert, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { getCompanyRows } from "@/features/company/list";

export const dynamic = "force-dynamic";

const statusStyle: Record<string, string> = {
  approved: "bg-[#e7f1eb] text-[#17452f]",
  pending: "bg-[#fdf1d4] text-[#805d14]",
  rejected: "bg-[#fff0ee] text-[#9a3024]",
  paused: "bg-[#eef0ed] text-[#536057]",
};

export default async function Page() {
  const result = await getCompanyRows();
  const companies = result.rows;
  const pendingCount = companies.filter((company) => company.status === "pending").length;

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <Link className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-[#17452f] transition hover:bg-[#e7f1eb] focus:outline-none focus:ring-4 focus:ring-[#17452f]/10" href="/admin">
          <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Till admin
        </Link>

        <div className="mt-6 flex flex-col gap-5 rounded-[1.75rem] bg-[#102a1c] p-7 text-white shadow-xl shadow-[#17452f]/10 sm:p-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Demo och företag</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Inkomna förfrågningar</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75">Granska företag som har bett om en demo och välj om de ska följas upp, godkännas eller avslås.</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-5 py-4 ring-1 ring-white/15">
            <p className="text-sm font-medium text-white/70">Väntar på uppföljning</p>
            <p className="mt-1 text-3xl font-bold">{pendingCount}</p>
          </div>
        </div>

        {!result.ok ? (
          <div className="mt-6 flex gap-3 rounded-2xl border border-[#e7b8b1] bg-[#fff4f2] p-5 text-[#8a2b20]">
            <CircleAlert className="h-5 w-5 shrink-0" aria-hidden="true" />
            <p>{result.message}</p>
          </div>
        ) : null}

        <div className="mt-6 grid gap-5">
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
    </main>
  );
}
