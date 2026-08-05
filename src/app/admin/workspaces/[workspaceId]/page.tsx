import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getAdminWorkspaceOverview } from "@/lib/admin-workspace-overview";
import { getPlatformAdmin } from "@/lib/platform-admin";

function StatCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
      {detail ? <p className="mt-2 text-xs text-slate-500">{detail}</p> : null}
    </article>
  );
}

export default async function AdminWorkspaceOverviewPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/logga-in");

  const { workspaceId } = await params;
  const overview = await getAdminWorkspaceOverview(workspaceId);
  if (!overview) notFound();

  const { workspace, recentBookings } = overview;
  const trialEndsAt = workspace.current_period_end ? new Date(String(workspace.current_period_end)) : null;

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Proffera Admin · Workspace overview</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">{String(workspace.company_name)}</h1>
          <p className="mt-2 text-sm text-slate-600">
            {String(workspace.slug)} · {String(workspace.status)} · senaste aktivitet {new Date(String(workspace.last_activity_at)).toLocaleString("sv-SE")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/workspaces" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Workspaces</Link>
          <Link href={`/admin/audit?workspace=${encodeURIComponent(String(workspace.id))}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Audit log</Link>
          {workspace.public_booking_slug ? (
            <Link href={`/boka/${String(workspace.public_booking_slug)}`} target="_blank" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Öppna bokningssida</Link>
          ) : null}
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Bokningar totalt" value={String(workspace.booking_count)} />
        <StatCard label="Kommande" value={String(workspace.upcoming_booking_count)} />
        <StatCard label="Senaste 30 dagar" value={String(workspace.bookings_last_30_days)} />
        <StatCard label="Kunder" value={String(workspace.customer_count)} />
        <StatCard label="Aktiva tjänster" value={String(workspace.active_service_count)} detail={`${String(workspace.service_count)} totalt`} />
        <StatCard label="Medlemmar" value={String(workspace.member_count)} />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Plan och trial</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
            <div><dt className="text-slate-500">Plan</dt><dd className="mt-1 font-semibold text-slate-950">{String(workspace.plan_key)}</dd></div>
            <div><dt className="text-slate-500">Status</dt><dd className="mt-1 font-semibold text-slate-950">{String(workspace.plan_status)}</dd></div>
            <div><dt className="text-slate-500">Start</dt><dd className="mt-1 font-semibold text-slate-950">{workspace.current_period_start ? new Date(String(workspace.current_period_start)).toLocaleDateString("sv-SE") : "—"}</dd></div>
            <div><dt className="text-slate-500">Slut</dt><dd className="mt-1 font-semibold text-slate-950">{trialEndsAt ? trialEndsAt.toLocaleDateString("sv-SE") : "—"}</dd></div>
          </dl>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-950">Företagsuppgifter</h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
            <div><dt className="text-slate-500">Ort</dt><dd className="mt-1 font-semibold text-slate-950">{String(workspace.primary_city ?? "—")}</dd></div>
            <div><dt className="text-slate-500">E-post</dt><dd className="mt-1 font-semibold text-slate-950">{String(workspace.contact_email ?? "—")}</dd></div>
            <div><dt className="text-slate-500">Telefon</dt><dd className="mt-1 font-semibold text-slate-950">{String(workspace.contact_phone ?? "—")}</dd></div>
            <div><dt className="text-slate-500">Timezone / valuta</dt><dd className="mt-1 font-semibold text-slate-950">{String(workspace.time_zone ?? "—")} · {String(workspace.billing_currency ?? "—")}</dd></div>
          </dl>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-xl font-bold text-slate-950">Senaste bokningar</h2>
          <p className="mt-1 text-sm text-slate-600">De 10 senast skapade bokningarna i detta workspace.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Skapad</th><th className="px-4 py-3">Kund</th><th className="px-4 py-3">Tjänst</th><th className="px-4 py-3">Tid</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentBookings.map((booking) => (
                <tr key={String(booking.id)}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{new Date(String(booking.created_at)).toLocaleString("sv-SE")}</td>
                  <td className="px-4 py-3"><div className="font-semibold text-slate-950">{String(booking.customer_name ?? "Okänd kund")}</div><div className="text-xs text-slate-500">{String(booking.customer_email ?? "")}</div></td>
                  <td className="px-4 py-3 text-slate-700">{String(booking.service ?? booking.title ?? "—")}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{booking.starts_at ? new Date(String(booking.starts_at)).toLocaleString("sv-SE") : "—"}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{String(booking.status)}</td>
                </tr>
              ))}
              {recentBookings.length === 0 ? <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Inga bokningar ännu.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
