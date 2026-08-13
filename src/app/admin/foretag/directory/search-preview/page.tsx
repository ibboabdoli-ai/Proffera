import Link from "next/link";
import { Search } from "lucide-react";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { searchCompanyDirectory } from "@/lib/company-directory-search";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    service?: string | string[];
    location?: string | string[];
  }>;
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DirectorySearchPreviewPage({ searchParams }: PageProps) {
  await requireSuperAdmin();
  const params = await (searchParams ?? Promise.resolve(undefined));
  const service = firstParam(params?.service) ?? "Rörmokare";
  const location = firstParam(params?.location) ?? "Stockholm";

  const search = await searchCompanyDirectory({
    service,
    location,
    streetAddressOnly: true,
    limit: 30,
  });

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 rounded-[1.75rem] bg-[#102a1c] p-7 text-white shadow-xl shadow-[#17452f]/10 sm:p-9">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Directory Search Pilot</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Service + Location</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
              Intern söktest mot Ready-profiler. Resultaten är inte offentliga och visar bara företag med användbar gatuadress.
            </p>
          </div>
          <Link href="/admin/foretag/directory" className="w-fit text-sm font-bold text-[#d6eadd] underline underline-offset-4">
            Tillbaka till Directory-kontroll
          </Link>
        </div>

        <form className="mt-7 grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-black/5 sm:grid-cols-[1fr_1fr_auto]" method="get">
          <label className="grid gap-2 text-sm font-bold text-[#2c392f]">
            Service
            <input
              name="service"
              defaultValue={search.serviceQuery}
              placeholder="Rörmokare"
              className="min-h-12 rounded-xl border border-black/10 bg-[#fafaf8] px-4 font-medium outline-none focus:border-[#17452f]"
            />
          </label>
          <label className="grid gap-2 text-sm font-bold text-[#2c392f]">
            Plats
            <input
              name="location"
              defaultValue={search.locationQuery}
              placeholder="Stockholm"
              className="min-h-12 rounded-xl border border-black/10 bg-[#fafaf8] px-4 font-medium outline-none focus:border-[#17452f]"
            />
          </label>
          <button className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#173e2b] px-5 font-black text-white" type="submit">
            <Search className="h-4 w-4" /> Sök
          </button>
        </form>

        {!search.serviceResolved ? (
          <div className="mt-5 rounded-2xl border border-[#e5cf9a] bg-[#fff8e4] p-4 text-sm font-semibold text-[#6d5418]">
            Tjänsten känns inte igen ännu. Testa till exempel Rörmokare, Elektriker, Städning, Målare eller Snickare.
          </div>
        ) : null}

        <div className="mt-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607066]">Pilotresultat</p>
            <h2 className="mt-1 text-2xl font-black text-[#17201a]">{search.results.length} företag</h2>
          </div>
          <p className="text-xs text-[#727d75]">Ready + street address · max 30</p>
        </div>

        <div className="mt-4 grid gap-3">
          {search.results.map((result, index) => (
            <article key={`${result.id}-${result.serviceSlug}`} className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[#6b766e]">#{index + 1} · {result.serviceLabel}</p>
                  <h3 className="mt-1 text-lg font-black text-[#202b24]">{result.companyName}</h3>
                  <p className="mt-2 text-sm text-[#5b665f]">
                    {[result.addressLine1, result.postalCode, result.city].filter(Boolean).join(", ")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-black">
                  <span className="rounded-full bg-[#edf4ef] px-3 py-1 text-[#17452f]">Quality {result.qualityScore}</span>
                  <span className="rounded-full bg-[#f0f1ee] px-3 py-1 text-[#5f6861]">{result.publicationStatus}</span>
                </div>
              </div>
            </article>
          ))}

          {search.serviceResolved && search.results.length === 0 ? (
            <div className="rounded-2xl bg-white p-6 text-sm text-[#68736b] ring-1 ring-black/5">
              Inga matchande Ready-profiler med gatuadress hittades för den här kombinationen.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
