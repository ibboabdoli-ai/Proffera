import Link from "next/link";
import { redirect } from "next/navigation";

import { getPlatformAdmin, listAdminWorkspaces } from "@/lib/platform-admin";
import { startSupportSessionAction } from "./actions";

export default async function AdminWorkspacesPage() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/logga-in");

  const workspaces = await listAdminWorkspaces();

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Proffera Admin</p>
          <h1 className="text-3xl font-bold text-slate-950">Workspaces</h1>
          <p className="mt-2 text-sm text-slate-600">Inloggad som {admin.email} · {admin.role}</p>
        </div>
        <Link className="text-sm font-semibold text-slate-700 underline" href="/dashboard">Till dashboard</Link>
      </header>

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
