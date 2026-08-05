import Link from "next/link";
import { redirect } from "next/navigation";

import { PLATFORM_ADMIN_ROLES, listPlatformAdmins } from "@/lib/platform-admin-management";
import { savePlatformAdminAction } from "./actions";

export default async function PlatformAdminsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const admins = await listPlatformAdmins();
  if (!admins) redirect("/admin/saas");
  const params = await searchParams;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Proffera Admin</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Platform admins</h1>
          <p className="mt-2 text-sm text-slate-600">Hantera interna roller utan att dela kundernas inloggningar.</p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm font-semibold">
          <Link href="/admin/saas" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">SaaS dashboard</Link>
          <Link href="/admin/audit?action=platform_admin.updated" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">Audit log</Link>
        </nav>
      </header>

      {params.saved === "1" ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">Adminåtkomsten har uppdaterats.</p> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-xl font-bold text-slate-950">Lägg till eller uppdatera admin</h2>
        <p className="mt-1 text-sm text-slate-600">Användaren måste redan ha ett Proffera-konto.</p>
        <form action={savePlatformAdminAction} className="mt-5 grid gap-4 md:grid-cols-[1fr_240px_auto_auto] md:items-end">
          <label className="grid gap-1 text-sm font-semibold text-slate-700">E-post
            <input name="email" type="email" required maxLength={320} className="rounded-lg border border-slate-300 px-3 py-2 font-normal" placeholder="admin@example.com" />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-700">Roll
            <select name="role" defaultValue="support_admin" className="rounded-lg border border-slate-300 px-3 py-2 font-normal">
              {PLATFORM_ADMIN_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" name="isActive" defaultChecked /> Aktiv
          </label>
          <button type="submit" className="rounded-lg bg-slate-950 px-4 py-2 font-semibold text-white">Spara</button>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4"><h2 className="text-xl font-bold text-slate-950">Nuvarande admins</h2></div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Admin</th><th className="px-4 py-3">Roll</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Uppdaterad</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {admins.map((row) => (
                <tr key={String(row.user_id)}>
                  <td className="px-4 py-3"><p className="font-semibold text-slate-950">{String(row.name || row.email)}</p><p className="text-xs text-slate-500">{String(row.email)}</p></td>
                  <td className="px-4 py-3 text-slate-700">{String(row.role)}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${row.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{row.is_active ? "Aktiv" : "Inaktiv"}</span></td>
                  <td className="px-4 py-3 text-slate-600">{new Date(String(row.updated_at)).toLocaleString("sv-SE")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
