import Link from "next/link";
import { redirect } from "next/navigation";

import { BillingAlertQueue } from "../billing-alert-queue";
import { canAccessAdminBilling, listAdminBillingWorkspaces } from "@/lib/admin-billing";
import { buildBillingAlertQueue, type BillingAlertKind } from "@/lib/admin-billing-alerts";
import { getPlatformAdmin } from "@/lib/platform-admin";

const alertOrder: BillingAlertKind[] = [
  "past_due",
  "trial_expired",
  "trial_ending_tomorrow",
  "trial_ending_3_days",
  "trial_ending_7_days",
];

const alertLabels: Record<BillingAlertKind, string> = {
  past_due: "Past due",
  trial_expired: "Trial expired",
  trial_ending_tomorrow: "Ends tomorrow",
  trial_ending_3_days: "Ends within 3 days",
  trial_ending_7_days: "Ends within 7 days",
};

export default async function AdminBillingAlertsPage() {
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/logga-in");
  if (!canAccessAdminBilling(admin.role)) redirect("/admin/saas");

  const result = await listAdminBillingWorkspaces();
  if (!result) redirect("/admin/saas");

  const alerts = buildBillingAlertQueue(result.workspaces);
  const counts = new Map<BillingAlertKind, number>();
  for (const alert of alerts) counts.set(alert.kind, (counts.get(alert.kind) ?? 0) + 1);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Proffera Admin</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Trial & payment alerts</h1>
          <p className="mt-2 max-w-3xl text-sm text-slate-600">Read-only detection. E-postleverans är avstängd tills template, mottagarregler och idempotent delivery persistence har godkänts.</p>
        </div>
        <Link href="/admin/billing" className="w-fit rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">Till Billing</Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {alertOrder.map((kind) => (
          <article key={kind} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{alertLabels[kind]}</p>
            <p className="mt-2 text-3xl font-bold text-slate-950">{counts.get(kind) ?? 0}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 shadow-sm">
        <p className="font-bold">No delivery in this phase</p>
        <p className="mt-1">Systemet skapar endast en intern, deterministisk alertkö. Ingen mottagare löses upp, ingen template renderas och inget meddelande skickas. Därför krävs ingen Production-migration i denna fas.</p>
      </section>

      <BillingAlertQueue alerts={alerts} />
    </main>
  );
}
