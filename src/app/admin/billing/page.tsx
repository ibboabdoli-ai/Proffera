import Link from "next/link";
import { redirect } from "next/navigation";

import { canAccessAdminBilling, listAdminBillingWorkspaces } from "@/lib/admin-billing";
import { getPlatformAdmin } from "@/lib/platform-admin";

function formatDate(value: unknown) {
  return value ? new Date(String(value)).toLocaleDateString("sv-SE") : "—";
}

function statusBadge(status: string) {
  if (status === "past_due") return "bg-red-50 text-red-700";
  if (status === "trialing") return "bg-amber-50 text-amber-800";
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  return "bg-slate-100 text-slate-700";
}

function TrialAlert({ workspace }: { workspace: Record<string, unknown> }) {
  if (workspace.trial_expired) {
    return <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">Trial har gått ut</span>;
  }
  if (!workspace.trial_ending_soon) return null;

  const days = Number(workspace.trial_days_remaining ?? 0);
  const label = days <= 1 ? "Trial slutar i morgon" : `Trial slutar om ${days} dagar`;
  const tone = days <= 1 ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string; status?: string }>;
}) {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/logga-in");
  if (!canAccessAdminBilling(admin.role)) redirect("/admin/saas");

  const params = await searchParams;
  const filters = {
    query: params.query ?? "",
    status: params.status ?? "",
  };
  const result = await listAdminBillingWorkspaces(filters);
  if (!result) redirect("/admin/saas");

  const { workspaces } = result;
  const pastDueCount = workspaces.filter((workspace) => workspace.subscription_status === "past_due").length;
  const endingSoonCount = workspaces.filter((workspace) => workspace.trial_ending_soon || workspace.trial_expired).length;
  const missingCount = workspaces.filter((workspace) => workspace.missing_subscription).length;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Proffera Admin</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Billing</h1>
          <p className="mt-2 text-sm text-slate-600">Read-only översikt · inloggad som {admin.email} · {admin.role}</p>
        </div>
        <nav className="flex flex-wrap gap-2 text-sm font-semibold">
          <Link href="/admin/saas" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">SaaS dashboard</Link>
          <Link href="/admin/workspaces" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">Workspaces</Link>
          <Link href="/admin/audit" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">Audit log</Link>
        </nav>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Visade workspaces</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{workspaces.length}</p>
        </article>
        <article className={`rounded-2xl border p-5 shadow-sm ${pastDueCount ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
          <p className={`text-sm font-semibold ${pastDueCount ? "text-red-700" : "text-slate-500"}`}>Past due</p>
          <p className={`mt-2 text-3xl font-bold ${pastDueCount ? "text-red-950" : "text-slate-950"}`}>{pastDueCount}</p>
        </article>
        <article className={`rounded-2xl border p-5 shadow-sm ${endingSoonCount ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
          <p className={`text-sm font-semibold ${endingSoonCount ? "text-amber-800" : "text-slate-500"}`}>Trial-varningar</p>
          <p className={`mt-2 text-3xl font-bold ${endingSoonCount ? "text-amber-950" : "text-slate-950"}`}>{endingSoonCount}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Utan subscription</p>
          <p className="mt-2 text-3xl font-bold text-slate-950">{missingCount}</p>
        </article>
      </section>

      <form method="get" className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[2fr_1fr_auto] md:items-end">
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Sök
          <input
            name="query"
            defaultValue={filters.query}
            maxLength={160}
            placeholder="Företag eller workspace-slug"
            className="rounded-lg border border-slate-300 px-3 py-2 font-normal"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-700">
          Subscription status
          <select name="status" defaultValue={filters.status} className="rounded-lg border border-slate-300 px-3 py-2 font-normal">
            <option value="">Alla</option>
            <option value="trialing">Trialing</option>
            <option value="active">Active</option>
            <option value="past_due">Past due</option>
            <option value="canceled">Canceled</option>
            <option value="none">Utan subscription</option>
          </select>
        </label>
        <div className="flex gap-2">
          <button type="submit" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Filtrera</button>
          <Link href="/admin/billing" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Rensa</Link>
        </div>
      </form>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Företag</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Trial</th>
                <th className="px-4 py-3">Länkar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workspaces.map((workspace) => {
                const status = String(workspace.subscription_status ?? "none");
                return (
                  <tr key={String(workspace.id)} className={status === "past_due" ? "bg-red-50/40" : ""}>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-950">{String(workspace.company_name)}</p>
                      <p className="mt-1 text-xs text-slate-500">{String(workspace.slug)}</p>
                    </td>
                    <td className="px-4 py-4 text-slate-700">{String(workspace.plan_key ?? "—")}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge(status)}`}>{status}</span>
                      {status === "past_due" ? <p className="mt-2 text-xs font-semibold text-red-700">Betalning kräver uppmärksamhet</p> : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-600">
                      <p>{formatDate(workspace.current_period_start)}</p>
                      <p className="mt-1">till {formatDate(workspace.current_period_end)}</p>
                    </td>
                    <td className="px-4 py-4">
                      <TrialAlert workspace={workspace} />
                      {status === "trialing" && !workspace.trial_ending_soon && !workspace.trial_expired ? (
                        <span className="text-sm text-slate-600">{String(workspace.trial_days_remaining ?? "—")} dagar kvar</span>
                      ) : null}
                      {workspace.missing_subscription ? <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">Ingen subscription</span> : null}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/admin/workspaces/${String(workspace.id)}`} className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-800">Workspace</Link>
                        <Link href={`/admin/audit?workspaceId=${encodeURIComponent(String(workspace.id))}`} className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-800">Audit</Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {workspaces.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Inga workspaces matchar filtret.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
