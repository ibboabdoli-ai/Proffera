import { ArrowLeft, CircleAlert, FlaskConical, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { BOLAGSVERKET_VDM_TEST_ORGANIZATION_NUMBERS } from "@/lib/company-directory-bolagsverket-testdata";
import {
  getCompanyDirectorySourceReadiness,
  previewCompanyDirectorySource,
} from "@/lib/company-directory-source-preview-admin";

export const dynamic = "force-dynamic";

type Props = {
  searchParams?: Promise<{
    run?: string | string[];
    org?: string | string[];
    batch?: string | string[];
    offset?: string | string[];
  }>;
};

function value(input?: string | string[]) {
  return Array.isArray(input) ? input[0] : input;
}

function safeOffset(input?: string) {
  const parsed = Number.parseInt(input ?? "0", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(parsed, Math.max(0, BOLAGSVERKET_VDM_TEST_ORGANIZATION_NUMBERS.length - 1));
}

export default async function DirectorySourcePreviewPage({ searchParams }: Props) {
  await requireSuperAdmin();
  const params = searchParams ? await searchParams : undefined;
  const shouldRun = value(params?.run) === "1";
  const requestedOrg = value(params?.org)?.replace(/\D/g, "") ?? "";
  const testBatch = value(params?.batch) === "1";
  const offset = safeOffset(value(params?.offset));
  const testBatchNumbers = BOLAGSVERKET_VDM_TEST_ORGANIZATION_NUMBERS.slice(offset, offset + 5);
  const readiness = getCompanyDirectorySourceReadiness();
  const sourceReady = readiness.detailConfigured && readiness.oauthConfigured
    && (readiness.sourceConfigured || readiness.officialTestCount > 0);

  let preview: Awaited<ReturnType<typeof previewCompanyDirectorySource>> | null = null;
  let error = "";

  if (shouldRun) {
    try {
      const requested = requestedOrg
        ? [requestedOrg]
        : testBatch
          ? [...testBatchNumbers]
          : [];
      preview = await previewCompanyDirectorySource(requested.length || 5, requested);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Källtestet misslyckades";
    }
  }

  const nextOffset = offset + 5 < BOLAGSVERKET_VDM_TEST_ORGANIZATION_NUMBERS.length ? offset + 5 : null;
  const previousOffset = offset > 0 ? Math.max(0, offset - 5) : null;

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

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
            <p className="text-xs font-black uppercase text-[#68756d]">Discovery mode</p>
            <p className="mt-2 font-black">{readiness.mode === "seed" ? "Seed pilot" : "Verified feed"}</p>
            {readiness.mode === "seed" ? <p className="mt-1 text-xs text-[#747e77]">{readiness.seedCount} org.nr konfigurerade</p> : null}
          </div>
          <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5"><p className="text-xs font-black uppercase text-[#68756d]">Discovery</p><p className="mt-2 font-black">{readiness.sourceConfigured ? "Konfigurerad" : "Väntar"}</p></div>
          <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5"><p className="text-xs font-black uppercase text-[#68756d]">OAuth</p><p className="mt-2 font-black">{readiness.oauthConfigured ? "Konfigurerad" : "Väntar"}</p></div>
          <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5"><p className="text-xs font-black uppercase text-[#68756d]">Detail verify</p><p className="mt-2 font-black">{readiness.detailConfigured ? "Konfigurerad" : "Väntar"}</p></div>
        </section>

        <div className="mt-6 rounded-2xl border border-[#d6e2d8] bg-[#f1f7f2] p-5 text-sm text-[#465349]">
          <p className="flex items-center gap-2 font-black text-[#17452f]"><ShieldCheck className="h-5 w-5" /> Säkerhetsregel</p>
          <p className="mt-2">Den här sidan skriver aldrig till Company Directory-tabellerna. Manuella tester tillåter endast organisationsnummer som finns i Bolagsverkets officiella TEST-data.</p>
        </div>

        <section className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-black/5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607066]">Officiell TEST-data</p>
              <h2 className="mt-2 text-xl font-black text-[#17201a]">Testa utan Vercel-ändring</h2>
              <p className="mt-1 text-sm text-[#707970]">{readiness.officialTestCount} dokumenterade organisationsnummer finns i den säkra TEST-listan.</p>
            </div>
          </div>

          <form method="get" className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <input type="hidden" name="run" value="1" />
            <label className="flex-1 text-sm font-bold text-[#344139]">
              Org.nr
              <input
                name="org"
                inputMode="numeric"
                pattern="[0-9 -]{10,13}"
                defaultValue={requestedOrg}
                placeholder="5560021361"
                className="mt-2 min-h-12 w-full rounded-xl border border-[#ccd7cf] bg-white px-4 text-[#17201a] outline-none focus:border-[#17452f]"
              />
            </label>
            <button
              type="submit"
              disabled={!sourceReady}
              className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#17452f] px-5 font-black text-white disabled:cursor-not-allowed disabled:bg-[#8f9992]"
            >
              Testa org.nr
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href={`/admin/foretag/directory/preview?run=1&batch=1&offset=${offset}`}
              className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-black ${sourceReady ? "bg-[#e8f1eb] text-[#17452f]" : "pointer-events-none bg-[#eef0ee] text-[#929a94]"}`}
              aria-disabled={!sourceReady}
            >
              Testa 5 officiella ({offset + 1}–{Math.min(offset + 5, readiness.officialTestCount)})
            </Link>
            {previousOffset !== null ? <Link href={`/admin/foretag/directory/preview?batch=1&offset=${previousOffset}`} className="rounded-xl px-3 py-2 text-sm font-bold text-[#536159] hover:bg-[#f1f4f2]">Föregående 5</Link> : null}
            {nextOffset !== null ? <Link href={`/admin/foretag/directory/preview?batch=1&offset=${nextOffset}`} className="rounded-xl px-3 py-2 text-sm font-bold text-[#536159] hover:bg-[#f1f4f2]">Nästa 5</Link> : null}
          </div>
        </section>

        {!shouldRun ? (
          <div className="mt-7">
            <Link
              href="/admin/foretag/directory/preview?run=1"
              className={`inline-flex min-h-12 items-center justify-center rounded-xl px-5 font-black text-white ${sourceReady ? "bg-[#17452f]" : "pointer-events-none bg-[#8f9992]"}`}
              aria-disabled={!sourceReady}
            >
              Testa konfigurerad seed utan att spara
            </Link>
            {!sourceReady ? <p className="mt-3 text-sm text-[#727b75]">Knappen aktiveras först när officiell detaljverifiering och OAuth är kompletta.</p> : null}
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
                    <span className="rounded-full bg-[#eef3ef] px-3 py-1 text-xs font-black text-[#17452f]">{result.assessment.score}/100</span>
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
