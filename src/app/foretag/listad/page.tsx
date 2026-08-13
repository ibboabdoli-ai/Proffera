import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, Search, ShieldCheck } from "lucide-react";

import { searchPublishedCompanyDirectory } from "@/lib/company-directory-public-search";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hitta företag | Proffera",
  description: "Sök publicerade företag på Proffera efter tjänst och ort.",
  robots: { index: false, follow: true },
};

type PageProps = {
  searchParams?: Promise<{
    service?: string | string[];
    location?: string | string[];
  }>;
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ListedDirectorySearchPage({ searchParams }: PageProps) {
  const params = await (searchParams ?? Promise.resolve(undefined));
  const service = firstParam(params?.service) ?? "";
  const location = firstParam(params?.location) ?? "";
  const searched = Boolean(service.trim() || location.trim());
  const search = searched
    ? await searchPublishedCompanyDirectory({ service, location, limit: 30 })
    : null;

  return (
    <main className="min-h-screen bg-[#f6f7f5] px-4 py-8 text-[#17201a] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="text-lg font-black text-[#173e2b]">Proffera</Link>

        <section className="mt-7 overflow-hidden rounded-[2rem] bg-[#102a1c] px-6 py-8 text-white shadow-sm sm:px-9 sm:py-10">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#a9dbb9]">Företagskatalog</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">Hitta rätt företag för jobbet</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/75 sm:text-base">
            Sök efter tjänst och ort. Resultaten visar endast företagsprofiler som Proffera har publicerat efter datakontroll.
          </p>

          <form method="get" className="mt-7 grid gap-3 rounded-2xl bg-white p-3 text-[#17201a] sm:grid-cols-[1fr_1fr_auto]">
            <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-[#5e6a61]">
              Tjänst
              <input
                name="service"
                defaultValue={service}
                placeholder="t.ex. Fönsterputsning"
                className="min-h-12 rounded-xl border border-black/10 bg-[#f8f9f7] px-4 text-sm font-semibold normal-case tracking-normal outline-none focus:border-[#173e2b]"
              />
            </label>
            <label className="grid gap-1.5 text-xs font-black uppercase tracking-wide text-[#5e6a61]">
              Ort
              <input
                name="location"
                defaultValue={location}
                placeholder="t.ex. Stockholm"
                className="min-h-12 rounded-xl border border-black/10 bg-[#f8f9f7] px-4 text-sm font-semibold normal-case tracking-normal outline-none focus:border-[#173e2b]"
              />
            </label>
            <button type="submit" className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-5 font-black text-white">
              <Search className="h-4 w-4" /> Sök
            </button>
          </form>
        </section>

        <aside className="mt-5 rounded-2xl border border-[#d7e4da] bg-[#f2f8f4] p-4 text-sm leading-6 text-[#465349]">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#173e2b]" />
            <p>
              Platsen i sökningen baseras på företagets registrerade adress. Det betyder inte automatiskt att företaget erbjuder tjänsten i hela området.
            </p>
          </div>
        </aside>

        {!searched ? (
          <section className="mt-8 rounded-2xl bg-white p-6 ring-1 ring-black/5">
            <h2 className="text-xl font-black">Börja med en tjänst eller ort</h2>
            <p className="mt-2 text-sm leading-6 text-[#667168]">Exempel: Fönsterputsning i Stockholm.</p>
          </section>
        ) : null}

        {search && !search.serviceResolved ? (
          <div className="mt-6 rounded-2xl border border-[#e5cf9a] bg-[#fff8e4] p-4 text-sm font-semibold text-[#6d5418]">
            Tjänsten känns inte igen ännu. Prova en bredare tjänst, till exempel Städning, Elektriker, VVS, Måleri eller Snickeri.
          </div>
        ) : null}

        {search?.serviceResolved ? (
          <section className="mt-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#647067]">Sökresultat</p>
                <h2 className="mt-1 text-2xl font-black">{search.results.length} företag</h2>
              </div>
              <p className="text-xs font-semibold text-[#758078]">Endast publicerade profiler · max 30</p>
            </div>

            <div className="mt-4 grid gap-3">
              {search.results.map((result) => (
                <article key={result.id} className="rounded-2xl bg-white p-5 ring-1 ring-black/5 sm:p-6">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[#e8f2ec] px-3 py-1 text-xs font-black text-[#173e2b]">{result.matchedServiceLabel}</span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#f2f4f2] px-3 py-1 text-xs font-bold text-[#536057]">
                          <ShieldCheck className="h-3.5 w-3.5" /> Officiella företagsdata
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-black">{result.companyName}</h3>
                      <p className="mt-2 flex items-center gap-2 text-sm text-[#5f6a62]">
                        <MapPin className="h-4 w-4" /> {[result.postalCode, result.city].filter(Boolean).join(" ")}
                      </p>
                    </div>
                    <Link
                      href={`/foretag/listad/${encodeURIComponent(result.slug)}`}
                      className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-[#173e2b] px-4 text-sm font-black text-[#173e2b]"
                    >
                      Visa profil <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </div>
                </article>
              ))}

              {search.results.length === 0 ? (
                <div className="rounded-2xl bg-white p-6 text-sm leading-6 text-[#68736b] ring-1 ring-black/5">
                  Inga publicerade företag hittades för den här sökningen ännu.
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
