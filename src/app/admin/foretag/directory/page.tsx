import {
  BadgeCheck,
  Ban,
  CircleAlert,
  Clock3,
  Database,
  Eye,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { getCompanyDirectoryAdminSnapshot } from "@/lib/company-directory-admin";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  if (!value) return "–";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return "–";
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Stockholm",
  }).format(parsed);
}

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 ring-1 ring-black/5">
      <span className="text-sm font-semibold text-[#344039]">{label}</span>
      <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${ok ? "bg-[#e7f1eb] text-[#17452f]" : "bg-[#f1f1ee] text-[#6c746e]"}`}>
        {ok ? "Klar" : "Av"}
      </span>
    </div>
  );
}

const statusStyle: Record<string, string> = {
  ready: "bg-[#e7f1eb] text-[#17452f]",
  published: "bg-[#e8f0ff] text-[#34508b]",
  claimed: "bg-[#e8f0ff] text-[#34508b]",
  review: "bg-[#fff4d9] text-[#76580d]",
  blocked: "bg-[#fff0ee] text-[#8c3327]",
  inactive: "bg-[#efefec] text-[#626b64]",
  imported: "bg-[#efefec] text-[#626b64]",
};

export default async function DirectoryEngineAdminPage() {
  const snapshot = await getCompanyDirectoryAdminSnapshot();
  const total = Object.values(snapshot.counts).reduce((sum, value) => sum + value, 0);

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-6xl">
        <div className="rounded-[1.75rem] bg-[#102a1c] p-7 text-white shadow-xl shadow-[#17452f]/10 sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Company Profile Engine</p>
          <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-black sm:text-4xl">Directory-kontroll</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
                Läsbar kontrollpanel för import, datakvalitet och pilotstatus. Publicering förblir avstängd tills riktiga Bolagsverket-data har verifierats.
              </p>
            </div>
            <Link href="/admin/foretag/claims" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-[#173e2b]">
              {snapshot.pendingClaims} väntande anspråk
            </Link>
          </div>
        </div>

        {!snapshot.schemaReady ? (
          <div className="mt-6 flex gap-3 rounded-2xl border border-[#ddc98f] bg-[#fff9e8] p-5 text-sm text-[#665019]">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">Directory-schema är inte installerat i den här miljön.</p>
              <p className="mt-1">Det är förväntat före rollout. Ingen data eller publicering sker förrän migrationsflödet har godkänts.</p>
            </div>
          </div>
        ) : null}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
            <Database className="h-5 w-5 text-[#17452f]" />
            <p className="mt-4 text-xs font-black uppercase tracking-wide text-[#718078]">Profiler</p>
            <p className="mt-1 text-3xl font-black text-[#17201a]">{total}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
            <BadgeCheck className="h-5 w-5 text-[#17452f]" />
            <p className="mt-4 text-xs font-black uppercase tracking-wide text-[#718078]">Ready</p>
            <p className="mt-1 text-3xl font-black text-[#17201a]">{snapshot.counts.ready ?? 0}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
            <Eye className="h-5 w-5 text-[#34508b]" />
            <p className="mt-4 text-xs font-black uppercase tracking-wide text-[#718078]">Publicerade</p>
            <p className="mt-1 text-3xl font-black text-[#17201a]">{snapshot.counts.published ?? 0}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
            <Ban className="h-5 w-5 text-[#8c3327]" />
            <p className="mt-4 text-xs font-black uppercase tracking-wide text-[#718078]">Blocked / review</p>
            <p className="mt-1 text-3xl font-black text-[#17201a]">{(snapshot.counts.blocked ?? 0) + (snapshot.counts.review ?? 0)}</p>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[1.5rem] bg-white p-6 ring-1 ring-black/5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607066]">Rollout status</p>
                <h2 className="mt-2 text-xl font-black text-[#17201a]">Säkert avstängd före pilot</h2>
              </div>
              <ShieldCheck className="h-6 w-6 text-[#17452f]" />
            </div>
            <div className="mt-5 grid gap-2">
              <Flag ok={snapshot.schemaReady} label="Directory-schema" />
              <Flag ok={snapshot.config.sourceConfigured} label="Gratis officiell discovery-källa" />
              <Flag ok={snapshot.config.detailConfigured} label="Officiell detaljverifiering" />
              <Flag ok={snapshot.config.oauthConfigured} label="Bolagsverket OAuth" />
              <Flag ok={snapshot.config.syncEnabled} label="Automatisk sync" />
              <Flag ok={snapshot.config.autoPublishEnabled} label="Automatisk publicering" />
            </div>
            <div className="mt-5 rounded-2xl bg-[#f6f8f5] p-4 text-sm leading-6 text-[#5b665f]">
              <p><strong>Provider:</strong> {snapshot.config.provider}</p>
              <p><strong>Pilot:</strong> {snapshot.config.pilotLocations.join(" + ")}</p>
              <p><strong>Max per körning:</strong> {snapshot.config.batchSize * snapshot.config.maxPages} källposter före kvalitetsfilter</p>
            </div>
          </div>

          <div className="rounded-[1.5rem] bg-white p-6 ring-1 ring-black/5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607066]">Sync history</p>
                <h2 className="mt-2 text-xl font-black text-[#17201a]">Senaste körningar</h2>
              </div>
              <RefreshCw className="h-6 w-6 text-[#17452f]" />
            </div>
            <div className="mt-5 space-y-3">
              {snapshot.latestRuns.length ? snapshot.latestRuns.map((run) => (
                <div key={run.id} className="rounded-2xl bg-[#f6f8f5] p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-black text-[#26332b]">{run.status}</span>
                    <span className="flex items-center gap-1 text-xs text-[#747e77]"><Clock3 className="h-3.5 w-3.5" /> {formatDate(run.startedAt)}</span>
                  </div>
                  <p className="mt-2 text-[#5f6a62]">Scanned {run.scanned} · Upserted {run.upserted} · Published {run.published} · Blocked {run.blocked} · Errors {run.errors}</p>
                  {run.errorSummary ? <p className="mt-2 text-xs text-[#8c3327]">{run.errorSummary}</p> : null}
                </div>
              )) : (
                <p className="rounded-2xl bg-[#f6f8f5] p-5 text-sm text-[#69736c]">Ingen sync har körts ännu.</p>
              )}
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[1.5rem] bg-white p-6 ring-1 ring-black/5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607066]">Quality queue</p>
              <h2 className="mt-2 text-xl font-black text-[#17201a]">Senaste profiler</h2>
            </div>
            <p className="text-xs text-[#747e77]">Read-only före pilotgodkännande</p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-black/10 text-xs uppercase tracking-wide text-[#6b766e]">
                <tr>
                  <th className="px-3 py-3">Företag</th>
                  <th className="px-3 py-3">Ort</th>
                  <th className="px-3 py-3">SNI</th>
                  <th className="px-3 py-3">Kvalitet</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Senast sync</th>
                  <th className="px-3 py-3">Profil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {snapshot.profiles.map((profile) => (
                  <tr key={profile.id}>
                    <td className="px-3 py-4"><p className="font-bold text-[#253129]">{profile.companyName}</p><p className="mt-1 text-xs text-[#747e77]">{profile.legalForm || "–"}</p></td>
                    <td className="px-3 py-4">{profile.city || profile.municipality || "–"}</td>
                    <td className="px-3 py-4"><p>{profile.sniCode || "–"}</p><p className="mt-1 max-w-52 truncate text-xs text-[#747e77]">{profile.sniLabel}</p></td>
                    <td className="px-3 py-4 font-black">{profile.qualityScore}/100</td>
                    <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusStyle[profile.status] ?? statusStyle.imported}`}>{profile.status}</span></td>
                    <td className="px-3 py-4 text-xs text-[#69736c]">{formatDate(profile.lastSyncedAt)}</td>
                    <td className="px-3 py-4">
                      {profile.status === "published" ? (
                        <Link href={`/foretag/listad/${encodeURIComponent(profile.slug)}`} target="_blank" className="font-bold text-[#17452f] underline underline-offset-4">Öppna</Link>
                      ) : <span className="text-xs text-[#8a918c]">Ej publik</span>}
                    </td>
                  </tr>
                ))}
                {!snapshot.profiles.length ? (
                  <tr><td className="px-3 py-8 text-center text-[#747e77]" colSpan={7}>Inga directory-profiler ännu.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
