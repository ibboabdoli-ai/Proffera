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

import { requireSuperAdmin } from "@/lib/admin-authorization";
import { getCompanyDirectoryAdminSnapshot } from "@/lib/company-directory-admin";
import { publishDirectoryProfileAction } from "./actions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{ publish?: string | string[] }>;
};

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

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
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

const confidenceStyle = {
  high: "bg-[#e7f1eb] text-[#17452f]",
  review: "bg-[#fff4d9] text-[#76580d]",
  low: "bg-[#fff0ee] text-[#8c3327]",
};

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

const safetyReasonLabels: Record<string, string> = {
  status_not_ready: "Profilen är inte Ready",
  organization_inactive: "Organisationen är inaktiv",
  privacy_blocked: "Privacy-spärr",
  not_public_eligible: "Inte publikationsberättigad",
  already_claimed: "Redan claimad",
  official_facts_missing: "Official Facts saknas",
  category_confidence_below_95: "Kategori under 95%",
  deregistered: "Avregistrerad",
  ongoing_legal_procedure: "Pågående avveckling/omstrukturering",
  advertising_blocked: "Reklamspärr",
};

const publishMessages: Record<string, { ok: boolean; text: string }> = {
  published: { ok: true, text: "Profilen publicerades efter den säkra kontrollen." },
  low_confidence: { ok: false, text: "Profilen publicerades inte. Kategorisäkerheten är under 95%." },
  unsafe: { ok: false, text: "Profilen publicerades inte eftersom en säkerhetskontroll stoppade den." },
  not_ready: { ok: false, text: "Profilen är inte längre Ready och publicerades därför inte." },
  invalid: { ok: false, text: "Ogiltigt profil-ID." },
  not_found: { ok: false, text: "Profilen kunde inte hittas." },
  database: { ok: false, text: "Databasen är inte tillgänglig." },
};

export default async function DirectoryEngineAdminPage({ searchParams }: PageProps) {
  await requireSuperAdmin();
  const [snapshot, params] = await Promise.all([
    getCompanyDirectoryAdminSnapshot(),
    searchParams ?? Promise.resolve(undefined),
  ]);
  const total = Object.values(snapshot.counts).reduce((sum, value) => sum + value, 0);
  const highConfidenceReady = snapshot.profiles.filter((profile) => profile.publishSafe).length;
  const manualReview = snapshot.profiles.filter(
    (profile) => profile.status === "ready" && !profile.publishSafe,
  ).length;
  const publishResult = firstParam(params?.publish);
  const publishMessage = publishResult ? publishMessages[publishResult] : undefined;

  return (
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-10 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <div className="rounded-[1.75rem] bg-[#102a1c] p-7 text-white shadow-xl shadow-[#17452f]/10 sm:p-9">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a9dbb9]">Company Profile Engine</p>
          <div className="mt-3 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-black sm:text-4xl">Directory-kontroll</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
                Systemet jämför nu primär SNI, hela den officiella SNI-listan, företagsnamn och verksamhetsbeskrivning innan publicering. Auto Publish är fortfarande avstängt.
              </p>
            </div>
            <Link href="/admin/foretag/claims" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white px-4 text-sm font-black text-[#173e2b]">
              {snapshot.pendingClaims} väntande anspråk
            </Link>
          </div>
        </div>

        {publishMessage ? (
          <div className={`mt-6 rounded-2xl border p-5 text-sm font-semibold ${publishMessage.ok ? "border-[#b8d9c2] bg-[#eef8f0] text-[#17452f]" : "border-[#e7b8b1] bg-[#fff4f2] text-[#8a2b20]"}`} role="status">
            {publishMessage.text}
          </div>
        ) : null}

        {!snapshot.schemaReady ? (
          <div className="mt-6 flex gap-3 rounded-2xl border border-[#ddc98f] bg-[#fff9e8] p-5 text-sm text-[#665019]">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-black">Directory-schema är inte installerat i den här miljön.</p>
              <p className="mt-1">Ingen data eller publicering sker tills schema och officiella fakta finns.</p>
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
            <p className="mt-4 text-xs font-black uppercase tracking-wide text-[#718078]">95%+ och säkra</p>
            <p className="mt-1 text-3xl font-black text-[#17201a]">{highConfidenceReady}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
            <CircleAlert className="h-5 w-5 text-[#76580d]" />
            <p className="mt-4 text-xs font-black uppercase tracking-wide text-[#718078]">Manuell granskning</p>
            <p className="mt-1 text-3xl font-black text-[#17201a]">{manualReview}</p>
          </div>
          <div className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
            <Eye className="h-5 w-5 text-[#34508b]" />
            <p className="mt-4 text-xs font-black uppercase tracking-wide text-[#718078]">Publicerade</p>
            <p className="mt-1 text-3xl font-black text-[#17201a]">{snapshot.counts.published ?? 0}</p>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[1.5rem] bg-white p-6 ring-1 ring-black/5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607066]">Publiceringsskydd</p>
                <h2 className="mt-2 text-xl font-black text-[#17201a]">Admin-godkännande först</h2>
              </div>
              <ShieldCheck className="h-6 w-6 text-[#17452f]" />
            </div>
            <div className="mt-5 grid gap-2">
              <Flag ok={snapshot.schemaReady} label="Directory-schema" />
              <Flag ok={snapshot.config.detailConfigured} label="Officiell detaljverifiering" />
              <Flag ok={snapshot.config.oauthConfigured} label="Bolagsverket OAuth" />
              <Flag ok={snapshot.config.syncEnabled} label="Automatisk sync" />
              <Flag ok={snapshot.config.autoPublishEnabled} label="Automatisk publicering" />
            </div>
            <div className="mt-5 rounded-2xl bg-[#f6f8f5] p-4 text-sm leading-6 text-[#5b665f]">
              <p><strong>Regel:</strong> Publicera-knappen visas bara när profilstatus är Ready, Official Facts finns, inga säkerhetsspärrar finns och Category Confidence är minst 95%.</p>
              <p className="mt-2"><strong>Testfas:</strong> Tabellen visar de första 100 profilerna för manuell kvalitetskontroll.</p>
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
              {snapshot.latestRuns.length ? snapshot.latestRuns.slice(0, 6).map((run) => (
                <div key={run.id} className="rounded-2xl bg-[#f6f8f5] p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-black text-[#26332b]">{run.status}</span>
                    <span className="flex items-center gap-1 text-xs text-[#747e77]"><Clock3 className="h-3.5 w-3.5" /> {formatDate(run.startedAt)}</span>
                  </div>
                  <p className="mt-2 text-[#5f6a62]">Scanned {run.scanned} · Upserted {run.upserted} · Published {run.published} · Blocked {run.blocked} · Errors {run.errors}</p>
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
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#607066]">Quality review</p>
              <h2 className="mt-2 text-xl font-black text-[#17201a]">Första 100 profilerna</h2>
            </div>
            <p className="text-xs text-[#747e77]">Ingen automatisk publicering</p>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="border-b border-black/10 text-xs uppercase tracking-wide text-[#6b766e]">
                <tr>
                  <th className="px-3 py-3">Företag</th>
                  <th className="px-3 py-3">Kategori</th>
                  <th className="px-3 py-3">SNI</th>
                  <th className="px-3 py-3">Official quality</th>
                  <th className="px-3 py-3">Category confidence</th>
                  <th className="px-3 py-3">Publish safety</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Åtgärd</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {snapshot.profiles.map((profile) => (
                  <tr key={profile.id} className="align-top">
                    <td className="px-3 py-4">
                      <p className="font-bold text-[#253129]">{profile.companyName}</p>
                      <p className="mt-1 text-xs text-[#747e77]">{profile.city || profile.municipality || "–"} · {profile.legalForm || "–"}</p>
                      <details className="mt-2 max-w-72 text-xs text-[#5f6a62]">
                        <summary className="cursor-pointer font-bold text-[#17452f]">Visa underlag</summary>
                        {profile.activityDescription ? <p className="mt-2 leading-5">{profile.activityDescription}</p> : <p className="mt-2">Ingen verksamhetsbeskrivning.</p>}
                        {profile.categorySignals.length ? (
                          <ul className="mt-2 list-disc space-y-1 pl-4">
                            {profile.categorySignals.map((signal) => <li key={signal}>{signal}</li>)}
                          </ul>
                        ) : null}
                        {profile.categoryWarnings.length ? (
                          <ul className="mt-2 list-disc space-y-1 pl-4 text-[#76580d]">
                            {profile.categoryWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                          </ul>
                        ) : null}
                      </details>
                    </td>
                    <td className="px-3 py-4 font-bold">{categoryLabels[profile.categorySlug] ?? profile.categorySlug ?? "–"}</td>
                    <td className="px-3 py-4"><p>{profile.sniCode || "–"}</p><p className="mt-1 max-w-52 text-xs text-[#747e77]">{profile.sniLabel}</p></td>
                    <td className="px-3 py-4 font-black">{profile.qualityScore}/100</td>
                    <td className="px-3 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${confidenceStyle[profile.categoryConfidenceLevel]}`}>
                        {profile.categoryConfidenceScore}/100
                      </span>
                      <p className="mt-2 text-xs text-[#747e77]">{profile.categoryConfidenceLevel === "high" ? "Hög säkerhet" : profile.categoryConfidenceLevel === "review" ? "Granska" : "Låg säkerhet"}</p>
                    </td>
                    <td className="px-3 py-4">
                      {profile.publishSafe ? (
                        <span className="rounded-full bg-[#e7f1eb] px-2.5 py-1 text-xs font-black text-[#17452f]">Klar</span>
                      ) : (
                        <div className="max-w-48 text-xs text-[#76580d]">
                          {profile.publishSafetyReasons.slice(0, 2).map((reason) => (
                            <p key={reason}>• {safetyReasonLabels[reason] ?? reason}</p>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusStyle[profile.status] ?? statusStyle.imported}`}>{profile.status}</span></td>
                    <td className="px-3 py-4">
                      {profile.status === "published" ? (
                        <Link href={`/foretag/listad/${encodeURIComponent(profile.slug)}`} target="_blank" className="font-bold text-[#17452f] underline underline-offset-4">Öppna</Link>
                      ) : profile.publishSafe ? (
                        <form action={publishDirectoryProfileAction}>
                          <input type="hidden" name="profileId" value={profile.id} />
                          <button type="submit" className="min-h-10 rounded-xl bg-[#17452f] px-4 py-2 text-sm font-black text-white transition hover:bg-[#123724] focus:outline-none focus:ring-4 focus:ring-[#17452f]/20">
                            Publicera
                          </button>
                        </form>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#76580d]"><Ban className="h-3.5 w-3.5" /> Granska</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!snapshot.profiles.length ? (
                  <tr><td className="px-3 py-8 text-center text-[#747e77]" colSpan={8}>Inga directory-profiler ännu.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
