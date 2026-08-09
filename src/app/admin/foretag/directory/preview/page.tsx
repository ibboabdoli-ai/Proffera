import { ArrowLeft, CircleAlert, FlaskConical, ShieldCheck } from "lucide-react";
import Link from "next/link";

import {
  getCompanyDirectorySourceReadiness,
  previewCompanyDirectorySource,
} from "@/lib/company-directory-source-preview-admin";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{ run?: string | string[] }>;
};

function value(input?: string | string[]) {
  return Array.isArray(input) ? input[0] : input;
}

export default async function DirectorySourcePreviewPage({ searchParams }: Props) {
  const params = searchParams ? await searchParams : undefined;
  const shouldRun = value(params?.run) === "1";
  const readiness = getCompanyDirectorySourceReadiness();

  let preview: Awaited<ReturnType<typeof previewCompanyDirectorySource>> | null = null;
  let error = "";

  if (shouldRun) {
    try {
      preview = await previewCompanyDirectorySource(5);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Källtestet misslyckades";
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <Link href="/admin/foretag/directory" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-[#17452f] hover:bg-[#e7f1eb]">
          <ArrowLeft className="h-4 w-4" /> Directory Engine
        </Link>

        <div className="mt-6 rounded-[1.75rem] bg-[#102a1c] p-7 text-white sm:p-9">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <FlaskConical className="h-6 w-6" />
          </div>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Read-only source test</p>
          <h1 className="mt-2 text-3xl font-black">Källtest utan databasändring</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
            Hämtar högst fem poster, normaliserar och kvalitetsbedömer dem. Inga profiler, claims eller sync-runs sparas.
          </p>
        </div>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5"><p className="text-xs font-black uppercase text-[#68756d]">Discovery</p><p className="mt-2 font-black">{readiness.sourceConfigured ? "Konfigurerad" : "Väntar"}</p></div>
          <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5"><p className="text-xs font-black uppercase text-[#68756d]">OAuth</p><p className="mt-2 font-black">{readiness.oauthConfigured ? "Konfigurerad" : "Väntar"}</p></div>
          <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5"><p className="text-xs font-black uppercase text-[#68756d]">Detail verify</p><p className="mt-2 font-black">{readiness.detailConfigured ? "Konfigurerad" : "Väntar"}</p></div>
        </section>

        <div className="mt-6 rounded-2xl border border-[#d6e2d8] bg-[#f1f7f2] p-5 text-sm text-[#465349]">
          <p className="flex items-center gap-2 font-black text-[#17452f]"><ShieldCheck className="h-5 w-5" /> Säkerhetsregel</p>
          <p className="mt-2">Den här sidan skriver aldrig till Company Directory-tabellerna. Den är avsedd för första kontrollen när Bolagsverket skickat anslutningsuppgifterna.</p>
        </div>

        {!shouldRun ? (
          <div className="mt-7">
            <Link
              href="/admin/foretag/directory/preview?run=1"
              className={`inline-flex min-h-12 items-center justify-center rounded-xl px-5 font-black text-white ${readiness.sourceConfigured ? "bg-[#17452f]" : "pointer-events-none bg-[#8f9992]"}`}
              aria-disabled={!readiness.sourceConfigured}
            >
              Testa 5 poster utan att spara
            </Link>
            {!readiness.sourceConfigured ? <p className="mt-3 text-sm text-[#727b75]">Knappen blir aktiv när den officiella gratiskällan är konfigurerad.</p> : null}
          </div>
        ) : null}

        {error ? (
          <div className="mt-7 flex gap-3 rounded-2xl border border-[#e5b8b1] bg-[#fff3f1] p-5 text-sm text-[#8b3024]">
            <CircleAlert className="h-5 w-5 shrink-0" /><p>{error}</p>
          </div>
        ) : null}

        {preview ? (
          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607066]">Resultat</p>
                <h2 className="mt-2 text-2xl font-black text-[#17201a]">{preview.count} normaliserade poster</h2>
              </div>
              <p className="text-xs text-[#707970]">Provider: {preview.provider}</p>
            </div>

            <div className="mt-5 grid gap-4">
              {preview.results.map((result, index) => result.ok ? (
                <article key={`${result.candidate.organizationNumber}-${index}`} className="rounded-2xl bg-white p-6 ring-1 ring-black/5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black text-[#17201a]">{result.candidate.legalName || "Namn saknas"}</h3>
                      <p className="mt-1 text-sm text-[#687169]">{result.candidate.city || "Ort saknas"} · {result.candidate.legalForm || "Företagsform saknas"}</p>
                    </div>
                    <span className="rounded-full bg-[#eef3ef] px-3 py-1 text-xs font-black text-[#17452f]">{result.assessment.qualityScore ?? result.assessment.score}/100</span>
                  </div>
                  <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    <div><dt className="text-[#778079]">Org.nr</dt><dd className="mt-1 font-bold">{result.candidate.organizationNumber}</dd></div>
                    <div><dt className="text-[#778079]">SNI</dt><dd className="mt-1 font-bold">{result.candidate.primarySniCode || "–"} {result.candidate.primarySniLabel}</dd></div>
                    <div><dt className="text-[#778079]">Aktiv</dt><dd className="mt-1 font-bold">{result.candidate.isActive ? "Ja" : "Nej"}</dd></div>
                    <div><dt className="text-[#778079]">F-skatt</dt><dd className="mt-1 font-bold">{result.candidate.fTaxStatus || "–"}</dd></div>
                    <div><dt className="text-[#778079]">Moms</dt><dd className="mt-1 font-bold">{result.candidate.vatStatus || "–"}</dd></div>
                    <div><dt className="text-[#778079]">Policy</dt><dd className="mt-1 font-bold">{result.assessment.publicationStatus}</dd></div>
                  </dl>
                  {result.assessment.reasons.length ? <p className="mt-4 text-xs text-[#7a6554]">Reasons: {result.assessment.reasons.join(", ")}</p> : null}
                </article>
              ) : (
                <article key={`${result.organizationNumber}-${index}`} className="rounded-2xl border border-[#e5b8b1] bg-[#fff6f4] p-5 text-sm text-[#8b3024]">
                  <p className="font-black">{result.organizationNumber || "Okänd post"}</p>
                  <p className="mt-1">{result.error}</p>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </section>
    </main>
  );
}
