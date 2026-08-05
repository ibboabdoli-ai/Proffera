import Link from "next/link";
import { redirect } from "next/navigation";

import { getAdminSaasDashboard } from "@/lib/admin-saas-dashboard";

function MetricCard({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warning" | "danger" }) {
  const className = tone === "danger"
    ? "border-red-200 bg-red-50 text-red-950"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-slate-200 bg-white text-slate-950";

  return (
    <article className={`rounded-2xl border p-5 shadow-sm ${className}`}>
      <p className="text-sm font-semibold opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </article>
  );
}

function workspaceWarnings(workspace: Record<string, unknown>) {
  return [
    workspace.trial_ending_soon ? "Trial slutar snart" : null,
    workspace.services_missing ? "Inga aktiva tjänster" : null,
    workspace.booking_page_missing ? "Bokningssida saknas" : null,
    workspace.contact_incomplete ? "Kontaktuppgifter saknas" : null,
    workspace.members_missing ? "Ingen medlem" : null,
  ].filter(Boolean) as string[];
}

export default async function AdminSaasPage() {
  const dashboard = await getAdminSaasDashboard();
  if (!dashboard) redirect("/logga-in");

  const { admin, summary, urgentWorkspaces, activeSessions, recentAudit } = dashboard;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Proffera Admin</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">SaaS dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">Inloggad som {admin.email} · {admin.role}</p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm font-semibold">
          <Link href="/admin/workspaces" className="rounded-lg bg-slate-950 px-4 py-2 text-white">Workspaces</Link>
          <Link href="/admin/audit" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">Audit log</Link>
          <Link href="/admin" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">Quote admin</Link>
        </nav>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
        <MetricCard label="Workspaces" value={summary.totalWorkspaces} />
        <MetricCard label="Behöver åtgärd" value={summary.attentionCount} tone={summary.attentionCount ? "warning" : "default"} />
        <MetricCard label="Trial" value={summary.trialingCount} />
        <MetricCard label="Aktiva planer" value={summary.activePlanCount} />
        <MetricCard label="Past due" value={summary.pastDueCount} tone={summary.pastDueCount ? "danger" : "default"} />
        <MetricCard label="Trial slutar snart" value={summary.trialsEndingSoon} tone={summary.trialsEndingSoon ? "warning" : "default"} />
        <MetricCard label="Supportsessioner" value={summary.activeSessionCount} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-xl font-bold text-slate-950">Behöver åtgärd</h2>
              <p className="mt-1 text-sm text-slate-600">De viktigaste Workspace-problemen just nu.</p>
            </div>
            <Link href="/admin/workspaces?attention=1" className="text-sm font-semibold text-slate-700 underline">Visa alla</Link>
          </div>
          <div className="divide-y divide-slate-100">
            {urgentWorkspaces.map((workspace) => (
              <div key={String(workspace.id)} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-950">{String(workspace.company_name)}</p>
                  <p className="mt-1 text-xs text-slate-500">{String(workspace.slug)} · {String(workspace.plan_key)} / {String(workspace.plan_status)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {workspaceWarnings(workspace).map((warning) => (
                      <span key={warning} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">{warning}</span>
                    ))}
                  </div>
                </div>
                <Link href={`/admin/workspaces/${String(workspace.id)}`} className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800">Öppna</Link>
              </div>
            ))}
            {urgentWorkspaces.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-500">Alla workspaces ser bra ut.</p> : null}
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-xl font-bold text-slate-950">Aktiva supportsessioner</h2>
            <p className="mt-1 text-sm text-slate-600">Pågående åtkomst till kundmiljöer.</p>
          </div>
          <div className="divide-y divide-slate-100">
            {activeSessions.map((session) => (
              <div key={String(session.id)} className="px-5 py-4">
                <p className="font-semibold text-slate-950">{String(session.workspace_name)}</p>
                <p className="mt-1 text-xs text-slate-500">{String(session.mode)} · slutar {new Date(String(session.expires_at)).toLocaleString("sv-SE")}</p>
                <p className="mt-2 text-sm text-slate-600">{String(session.reason)}</p>
              </div>
            ))}
            {activeSessions.length === 0 ? <p className="px-5 py-10 text-center text-sm text-slate-500">Inga aktiva sessioner.</p> : null}
          </div>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Senaste adminaktivitet</h2>
            <p className="mt-1 text-sm text-slate-600">Senaste support- och ändringshändelserna.</p>
          </div>
          <Link href="/admin/audit" className="text-sm font-semibold text-slate-700 underline">Öppna audit log</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Tid</th><th className="px-4 py-3">Admin</th><th className="px-4 py-3">Workspace</th><th className="px-4 py-3">Händelse</th><th className="px-4 py-3">Orsak</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentAudit.map((log) => (
                <tr key={String(log.id)}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(String(log.created_at)).toLocaleString("sv-SE")}</td>
                  <td className="px-4 py-3 text-slate-700">{String(log.admin_name || log.admin_email)}</td>
                  <td className="px-4 py-3 text-slate-700">{String(log.workspace_name || "System")}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{String(log.action)}</td>
                  <td className="max-w-md px-4 py-3 text-slate-600">{String(log.reason || "—")}</td>
                </tr>
              ))}
              {recentAudit.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Ingen adminaktivitet ännu.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
