import Link from "next/link";

import type { BillingAlert } from "@/lib/admin-billing-alerts";

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString("sv-SE") : "Ingen period angiven";
}

export function BillingAlertQueue({ alerts }: { alerts: BillingAlert[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Billing alert queue</h2>
          <p className="mt-1 text-sm text-slate-600">Read-only detection med deterministisk idempotency. Ingen e-post eller annan notifiering skickas.</p>
        </div>
        <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Leverans avstängd · {alerts.length} alerts</span>
      </div>

      {alerts.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">Inga trial- eller payment-alerts har identifierats.</p>
      ) : (
        <div className="divide-y divide-slate-100">
          {alerts.map((alert) => {
            const critical = alert.severity === "critical";
            return (
              <article key={alert.dedupeKey} className={`grid gap-4 px-5 py-4 md:grid-cols-[1.5fr_1fr_auto] md:items-center ${critical ? "bg-red-50/40" : "bg-amber-50/30"}`}>
                <div>
                  <p className="font-semibold text-slate-950">{alert.companyName}</p>
                  <p className={`mt-1 text-sm font-semibold ${critical ? "text-red-700" : "text-amber-800"}`}>{alert.label}</p>
                  <p className="mt-1 text-xs text-slate-500">Periodslut: {formatDate(alert.currentPeriodEnd)} · Källa: {alert.billingSource === "stripe" ? "Stripe webhook" : "Internal"}</p>
                </div>
                <div className="text-xs text-slate-600">
                  <p className="font-semibold text-slate-800">Duplicate prevention</p>
                  <p className="mt-1">En stabil nyckel är genererad för workspace, alerttyp och period. Nyckeln exponeras inte i UI.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/admin/workspaces/${encodeURIComponent(alert.workspaceId)}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800">Workspace</Link>
                  <Link href={`/admin/audit?workspaceId=${encodeURIComponent(alert.workspaceId)}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800">Audit</Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
