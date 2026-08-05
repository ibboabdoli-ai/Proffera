import Link from "next/link";
import { redirect } from "next/navigation";

import { getPlatformAdmin, listActiveSupportSessions, listAdminWorkspaces } from "@/lib/platform-admin";
import { endSupportSessionAction, startSupportSessionAction } from "./actions";

export default async function AdminWorkspacesPage() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/logga-in");

  const [workspaces, activeSessions] = await Promise.all([
    listAdminWorkspaces(),
    listActiveSupportSessions(),
  ]);

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
                <tr>
                  <th className="px-3 py-3">Workspace</th>
                  <th className="px-3 py-3">Admin</th>
                  <th className="px-3 py-3">Läge</th>
                  <th className="px-3 py-3">Orsak</th>
                  <th className="px-3 py-3">Går ut</th>
                  <th className="px-3 py-3">Åtgärd</th>
                </tr>
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
                        <button type="submit" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-700">
                          Avsluta
                        </button>
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
              <tr>
                <th className="px-5 py-3">Företag</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Medlemmar</th>
                <th className="px-5 py-3">Supportläge</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workspaces.map((workspace) => (
                <tr key={String(workspace.id)} className="align-top">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-950">{String(workspace.name)}</div>
                    <div className="mt-1 text-xs text-slate-500">{String(workspace.slug)}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-700">{String(workspace.plan_key)} · {String(workspace.plan_status)}</td>
                  <td className="px-5 py-4 text-slate-700">{String(workspace.status)}</td>
                  <td className="px-5 py-4 text-slate-700">{String(workspace.member_count)}</td>
                  <td className="px-5 py-4">
                    <form action={startSupportSessionAction} className="flex min-w-72 flex-col gap-2">
                      <input type="hidden" name="workspaceId" value={String(workspace.id)} />
                      <input
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        name="reason"
                        minLength={8}
                        maxLength={500}
                        required
                        placeholder="Anledning, t.ex. felsök bokning"
                      />
                      <button className="rounded-lg bg-slate-950 px-3 py-2 font-semibold text-white" type="submit">
                        Öppna read-only
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
