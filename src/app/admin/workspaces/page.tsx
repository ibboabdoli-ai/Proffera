import Link from "next/link";
import { redirect } from "next/navigation";

import { listAdminWorkspaceDirectory } from "@/lib/admin-workspace-directory";
import { getPlatformAdmin, listActiveSupportSessions } from "@/lib/platform-admin";
import { endSupportSessionAction, startSupportSessionAction } from "./actions";

function HealthBadges({ workspace }: { workspace: Record<string, unknown> }) {
  const badges = [
    workspace.trial_ending_soon ? "Trial slutar snart" : null,
    workspace.services_missing ? "Inga aktiva tjänster" : null,
    workspace.booking_page_missing ? "Bokningssida saknas" : null,
    workspace.contact_incomplete ? "Kontaktuppgifter saknas" : null,
    workspace.members_missing ? "Ingen medlem" : null,
  ].filter(Boolean) as string[];

  if (badges.length === 0) {
    return <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">OK</span>;
  }

  return (
    <div className="flex max-w-sm flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span key={badge} className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
          {badge}
        </span>
      ))}
    </div>
  );
}

export default async function AdminWorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; planStatus?: string; attention?: string }>;
}) {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/logga-in");

  const params = await searchParams;
  const filters = {
    query: params.query ?? "",
    planStatus: params.planStatus ?? "",
    attentionOnly: params.attention === "1",
  };

  const [workspaces, activeSessions] = await Promise.all([
    listAdminWorkspaceDirectory(filters),
    listActiveSupportSessions(),
  ]);

  const attentionCount = workspaces.filter((workspace) =>
    workspace.trial_ending_soon || workspace.services_missing || workspace.booking_page_missing || workspace.contact_incomplete || workspace.members_missing,
  ).length;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Proffera Admin</p>
          <h1 className="text-3xl font-bold text-slate-950">Workspaces</h1>
          <p className="mt-2 text-sm text-slate-600">Inloggad som {admin.email} · {admin.role}</p>
        </div>
        <div className="flex gap-4 text-sm font-semibold">
          <Link className="text-slate-700 underline" href="/admin/audit">Audit log</Link>
          <Link className="text-slate-700 underline" href="/dashboard">Till dashboard</Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Visade workspaces</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{workspaces.length}</p>
        </article>
        <article className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-sm font-semibold text-amber-800">Behöver uppmärksamhet</p>
          <p className="mt-2 text-3xl font-bold text-amber-950">{attentionCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Aktiva supportsessioner</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{activeSessions.length}</p>
        </article>
      </section>

      <form method="get" className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-4">
        <label className="grid gap-1 text-sm font-semibold text-slate-700 md:col-span-2">
          Sök
          <input
            name="query"
            defaultValue={filters.query}
            maxLength={160}
            placeholder="Företag, slug eller e-post"
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Planstatus
          <select name="planStatus" defaultValue={filters.planStatus} className="rounded-lg border border-slate-300 px-3 py-2 font-normal">
            <option value="">Alla</option>
            <option value="trialing">Trial</option>
            <option value="active">Active</option>
            <option value="past_due">Past due</option>
            <option value="canceled">Canceled</option>
            <option value="none">Ingen plan</option>
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" name="attention" value="1" defaultChecked={filters.attentionOnly} />
            Endast varningar
          </label>
          <button type="submit" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Filtrera</button>
          <Link href="/admin/workspaces" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Rensa</Link>
        </div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Aktiva supportsessioner</h2>
            <p className="mt-1 text-sm text-slate-600">Sessioner löper ut automatiskt efter 30 minuter.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{activeSessions.length}</span>
        </div>

        {activeSessions.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-600">Inga aktiva supportsessioner.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr><th className="px-3 py-3">Workspace</th><th className="px-3 py-3">Admin</th><th className="px-3 py-3">Läge</th><th className="px-3 py-3">Orsak</th><th className="px-3 py-3">Går ut</th><th className="px-3 py-3">Åtgärd</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeSessions.map((session) => (
                  <tr key={String(session.id)}>
                    <td className="px-3 py-3 font-semibold text-slate-950">{String(session.workspace_name)}</td>
                    <td className="px-3 py-3 text-slate-700">{String(session.admin_name || session.admin_email)}</td>
                    <td className="px-3 py-3 text-slate-700">{String(session.mode)}</td>
                    <td className="max-w-sm px-3 py-3 text-slate-600">{String(session.reason)}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">{new Date(String(session.expires_at)).toLocaleString("sv-SE")}</td>
                    <td className="px-3 py-3">
                      <form action={endSupportSessionAction}>
                        <input type="hidden" name="sessionId" value={String(session.id)} />
                        <button type="submit" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-700">Avsluta</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr><th className="px-5 py-3">Företag</th><th className="px-5 py-3">Plan</th><th className="px-5 py-3">Hälsa</th><th className="px-5 py-3">Översikt</th><th className="px-5 py-3">Supportläge</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workspaces.map((workspace) => (
                <tr key={String(workspace.id)} className="align-top">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-950">{String(workspace.company_name)}</div>
                    <div className="mt-1 text-xs text-slate-500">{String(workspace.slug)} · {String(workspace.status)}</div>
                    <div className="mt-1 text-xs text-slate-500">{String(workspace.member_count)} medlemmar · {String(workspace.active_service_count)} aktiva tjänster</div>
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    <div>{String(workspace.plan_key)} · {String(workspace.plan_status)}</div>
                    {workspace.current_period_end ? <div className="mt-1 text-xs text-slate-500">Slut {new Date(String(workspace.current_period_end)).toLocaleDateString("sv-SE")}</div> : null}
                  </td>
                  <td className="px-5 py-4"><HealthBadges workspace={workspace} /></td>
                  <td className="px-5 py-4">
                    <Link href={`/admin/workspaces/${String(workspace.id)}`} className="inline-flex rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-800">Visa översikt</Link>
                  </td>
                  <td className="px-5 py-4">
                    <form action={startSupportSessionAction} className="flex min-w-72 flex-col gap-2">
                      <input type="hidden" name="workspaceId" value={String(workspace.id)} />
                      <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" name="reason" minLength={8} maxLength={500} required placeholder="Anledning, t.ex. felsök bokning" />
                      <button className="rounded-lg bg-slate-950 px-3 py-2 font-semibold text-white" type="submit">Öppna read-only</button>
                    </form>
                  </td>
                </tr>
              ))}
              {workspaces.length === 0 ? <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">Inga workspaces matchar filtret.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
