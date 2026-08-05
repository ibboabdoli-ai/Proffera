import Link from "next/link";
import { redirect } from "next/navigation";

import { listAdminAuditLogs } from "@/lib/admin-audit";
import { getPlatformAdmin } from "@/lib/platform-admin";

function formatAuditValue(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

export default async function AdminAuditPage() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/logga-in");
  const logs = await listAdminAuditLogs();

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Proffera Admin</p>
          <h1 className="text-3xl font-bold text-slate-950">Audit log</h1>
          <p className="mt-2 text-sm text-slate-600">Support access, administrative activity and recorded value changes.</p>
        </div>
        <Link href="/admin/workspaces" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold">Workspaces</Link>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Admin</th>
              <th className="px-4 py-3">Workspace</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => {
              const previousValue = formatAuditValue(log.previous_value);
              const newValue = formatAuditValue(log.new_value);
              return (
                <tr key={String(log.id)} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(String(log.created_at)).toLocaleString("sv-SE")}</td>
                  <td className="px-4 py-3">{String(log.admin_name || log.admin_email)}</td>
                  <td className="px-4 py-3">{String(log.workspace_name || "System")}</td>
                  <td className="px-4 py-3 font-medium">{String(log.action)}</td>
                  <td className="max-w-md px-4 py-3 text-slate-600">{String(log.reason || "—")}</td>
                  <td className="min-w-80 px-4 py-3">
                    {previousValue || newValue ? (
                      <details>
                        <summary className="cursor-pointer font-semibold text-slate-800">Visa ändring</summary>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Före</p>
                            <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{previousValue ?? "—"}</pre>
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Efter</p>
                            <pre className="max-h-64 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">{newValue ?? "—"}</pre>
                          </div>
                        </div>
                      </details>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {logs.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No audit events yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
