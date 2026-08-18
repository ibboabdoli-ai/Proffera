import { Ban, Database, Eye, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { getCompanyDirectoryAdminSnapshot } from "@/lib/company-directory-admin";
import { publishDirectoryProfileAction } from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;
const statusFilters = [
  { value: "all", label: "Alla" },
  { value: "published", label: "Publicerade" },
  { value: "ready", label: "Ready" },
  { value: "review", label: "Review" },
  { value: "inactive", label: "Inaktiva" },
] as const;
type DirectoryStatusFilter = (typeof statusFilters)[number]["value"];

type PageProps = {
  searchParams?: Promise<{
    publish?: string | string[];
    status?: string | string[];
    q?: string | string[];
    page?: string | string[];
  }>;
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeStatus(value?: string | string[]): DirectoryStatusFilter {
  const candidate = firstParam(value)?.trim().toLowerCase();
  return statusFilters.some((filter) => filter.value === candidate)
    ? candidate as DirectoryStatusFilter
    : "all";
}

function normalizePage(value?: string | string[]) {
  const parsed = Number(firstParam(value));
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1;
}

function directoryHref(input: { status: DirectoryStatusFilter; query: string; page?: number }) {
  const params = new URLSearchParams();
  if (input.status !== "all") params.set("status", input.status);
  if (input.query) params.set("q", input.query);
  if ((input.page ?? 1) > 1) params.set("page", String(input.page));
  const queryString = params.toString();
  return `/admin/foretag/directory${queryString ? `?${queryString}` : ""}`;
}

const categoryLabels: Record<string, string> = {
  stadning: "Städning",
  elektriker: "Elektriker",
  vvs: "VVS",
  maleri: "Måleri",
  snickeri: "Snickeri",
  tradgard: "Trädgård",
  flytt: "Flytt",
  hemservice: "Hemservice",
};

const publishMessages: Record<string, string> = {
  published: "Profilen publicerades efter den säkra kontrollen.",
  low_confidence: "Profilen publicerades inte. Kategorisäkerheten är under 95%.",
  unsafe: "Profilen publicerades inte eftersom en säkerhetskontroll stoppade den.",
  not_ready: "Profilen är inte längre Ready.",
  invalid: "Ogiltigt profil-ID.",
  not_found: "Profilen kunde inte hittas.",
  database: "Databasen är inte tillgänglig.",
};

export default async function DirectoryEngineAdminPage({ searchParams }: PageProps) {
  await requireSuperAdmin();
  const params = await (searchParams ?? Promise.resolve(undefined));
  const currentStatus = normalizeStatus(params?.status);
  const searchQuery = (firstParam(params?.q) ?? "").trim().slice(0, 120);
  const snapshot = await getCompanyDirectoryAdminSnapshot({
    status: currentStatus,
    query: searchQuery,
    page: normalizePage(params?.page),
    pageSize: PAGE_SIZE,
  });

  const total = Object.values(snapshot.counts).reduce((sum, value) => sum + value, 0);
  const { page, pageSize, total: filteredTotal, totalPages } = snapshot.profilePage;
  const visibleFrom = filteredTotal ? (page - 1) * pageSize + 1 : 0;
  const visibleTo = Math.min((page - 1) * pageSize + snapshot.profiles.length, filteredTotal);
  const publishResult = firstParam(params?.publish);

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-[1.75rem] bg-[#102a1c] p-7 text-white shadow-xl sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Company Profile Engine</p>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">Directory-kontroll</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
            Profiler hämtas nu sida för sida direkt från databasen. Automatisk publicering är {snapshot.config.autoPublishEnabled ? "aktiverad med säkerhetskontroller" : "avstängd"}.
          </p>
        </div>

        {publishResult && publishMessages[publishResult] ? (
          <div className="mt-6 rounded-2xl border border-black/10 bg-white p-4 text-sm font-semibold text-[#344039]" role="status">
            {publishMessages[publishResult]}
          </div>
        ) : null}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Profiler", total],
            ["Ready", snapshot.counts.ready ?? 0],
            ["Review", snapshot.counts.review ?? 0],
            ["Publicerade", snapshot.counts.published ?? 0],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
              <Database className="h-5 w-5 text-[#17452f]" />
              <p className="mt-4 text-xs font-black uppercase tracking-wide text-[#718078]">{label}</p>
              <p className="mt-1 text-3xl font-black text-[#17201a]">{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-7 rounded-2xl bg-white p-5 ring-1 ring-black/5">
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-[#344039]">
            <ShieldCheck className="h-5 w-5 text-[#17452f]" />
            <span>Schema: {snapshot.schemaReady ? "Klar" : "Saknas"}</span>
            <span>Official Facts: {snapshot.config.detailConfigured ? "Klar" : "Av"}</span>
            <span>OAuth: {snapshot.config.oauthConfigured ? "Klar" : "Av"}</span>
            <span>Sync: {snapshot.config.syncEnabled ? "På" : "Av"}</span>
            <Link href="/admin/foretag/claims" className="ml-auto font-black text-[#17452f] underline underline-offset-4">
              {snapshot.pendingClaims} väntande anspråk
            </Link>
          </div>
        </section>

        <section className="mt-8 rounded-[1.5rem] bg-white p-6 ring-1 ring-black/5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-[#17201a]">Directory profiles</h2>
              <p className="mt-2 text-sm text-[#747e77]">Visar {visibleFrom}–{visibleTo} av {filteredTotal} träffar</p>
            </div>
            <form action="/admin/foretag/directory" method="get" className="flex w-full max-w-2xl flex-col gap-2 sm:flex-row">
              {currentStatus !== "all" ? <input type="hidden" name="status" value={currentStatus} /> : null}
              <input name="q" defaultValue={searchQuery} maxLength={120} aria-label="Sök företag, stad, kategori eller SNI" placeholder="Sök företag, stad, kategori eller SNI" className="min-h-11 flex-1 rounded-xl border border-[#dfe5dd] px-4 text-sm outline-none focus:border-[#17452f]" />
              <button type="submit" className="min-h-11 rounded-xl bg-[#17452f] px-5 text-sm font-black text-white">Sök</button>
              {(searchQuery || currentStatus !== "all") ? <Link href="/admin/foretag/directory" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#dfe5dd] px-4 text-sm font-bold">Rensa</Link> : null}
            </form>
          </div>

          <nav className="mt-5 flex flex-wrap gap-2" aria-label="Filtrera directory-profiler">
            {statusFilters.map((filter) => {
              const count = filter.value === "all" ? total : snapshot.counts[filter.value] ?? 0;
              const active = currentStatus === filter.value;
              return <Link key={filter.value} href={directoryHref({ status: filter.value, query: searchQuery })} aria-current={active ? "page" : undefined} className={`rounded-full px-4 py-2 text-sm font-black ${active ? "bg-[#17452f] text-white" : "bg-[#f1f4ef] text-[#344039]"}`}>{filter.label} · {count}</Link>;
            })}
          </nav>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="border-b border-black/10 text-xs uppercase tracking-wide text-[#6b766e]">
                <tr><th className="px-3 py-3">Företag</th><th className="px-3 py-3">Kategori</th><th className="px-3 py-3">SNI</th><th className="px-3 py-3">Confidence</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Åtgärd</th></tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {snapshot.profiles.map((profile) => (
                  <tr key={profile.id} className="align-top">
                    <td className="px-3 py-4"><p className="font-bold text-[#253129]">{profile.companyName}</p><p className="mt-1 text-xs text-[#747e77]">{profile.city || profile.municipality || "–"} · {profile.legalForm || "–"}</p></td>
                    <td className="px-3 py-4 font-bold">{categoryLabels[profile.categorySlug] || profile.categorySlug || "–"}</td>
                    <td className="px-3 py-4"><p>{profile.sniCode || "–"}</p><p className="mt-1 max-w-52 text-xs text-[#747e77]">{profile.sniLabel}</p></td>
                    <td className="px-3 py-4"><span className="rounded-full bg-[#eef3ed] px-2.5 py-1 text-xs font-black text-[#17452f]">{profile.categoryConfidenceScore}/100</span></td>
                    <td className="px-3 py-4 font-bold">{profile.status}</td>
                    <td className="px-3 py-4">
                      {profile.status === "published" ? <Link href={`/foretag/listad/${encodeURIComponent(profile.slug)}`} target="_blank" className="inline-flex items-center gap-1 font-bold text-[#17452f] underline underline-offset-4"><Eye className="h-4 w-4" /> Öppna</Link> : profile.publishSafe ? (
                        <form action={publishDirectoryProfileAction}>
                          <input type="hidden" name="profileId" value={profile.id} /><input type="hidden" name="returnStatus" value={currentStatus} /><input type="hidden" name="returnQuery" value={searchQuery} /><input type="hidden" name="returnPage" value={page} />
                          <button type="submit" className="min-h-10 rounded-xl bg-[#17452f] px-4 text-sm font-black text-white">Publicera</button>
                        </form>
                      ) : <span className="inline-flex items-center gap-1 text-xs font-bold text-[#76580d]"><Ban className="h-3.5 w-3.5" /> Granska</span>}
                    </td>
                  </tr>
                ))}
                {!snapshot.profiles.length ? <tr><td className="px-3 py-8 text-center text-[#747e77]" colSpan={6}>Inga profiler matchar filtret.</td></tr> : null}
              </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div className="mt-6 flex items-center justify-between border-t border-black/5 pt-5">
              <p className="text-sm font-semibold text-[#5f6a62]">Sida {page} av {totalPages}</p>
              <div className="flex gap-2">
                {page > 1 ? <Link href={directoryHref({ status: currentStatus, query: searchQuery, page: page - 1 })} className="rounded-xl border border-[#dfe5dd] px-4 py-2 text-sm font-bold">← Föregående</Link> : null}
                {page < totalPages ? <Link href={directoryHref({ status: currentStatus, query: searchQuery, page: page + 1 })} className="rounded-xl bg-[#17452f] px-4 py-2 text-sm font-bold text-white">Nästa →</Link> : null}
              </div>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}
