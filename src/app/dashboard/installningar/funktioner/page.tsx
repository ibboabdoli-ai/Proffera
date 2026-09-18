import { SlidersHorizontal } from "lucide-react";
import { redirect } from "next/navigation";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import { getWorkspaceEntitlements, setWorkspaceFeatureEnabled, startWorkspaceFeatureTrial } from "@/lib/workspace-entitlements";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

async function toggleFeature(formData: FormData) {
  "use server";
  await setWorkspaceFeatureEnabled(String(formData.get("featureKey") ?? ""), formData.get("enabled") === "true");
  redirect("/dashboard/installningar/funktioner?updated=1");
}

async function startTrial(formData: FormData) {
  "use server";
  await startWorkspaceFeatureTrial(String(formData.get("featureKey") ?? ""));
  redirect("/dashboard/installningar/funktioner?trial=1");
}

export default async function FeatureSettingsPage({ searchParams }: { searchParams?: Promise<{ updated?: string; trial?: string }> }) {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) redirect("/dashboard");
  const params = searchParams ? await searchParams : {};
  const features = await getWorkspaceEntitlements();

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow="Funktioner och plan"
        title="Aktivera det företaget behöver"
        description="Varje funktion styrs av arbetsytans plan, eventuell 14-dagars testperiod och ditt eget val. Inställningar sparas även när en testperiod tar slut."
        icon={SlidersHorizontal}
      />

      {params.updated === "1" ? <p className="rounded-card border border-[#cfe8d6] bg-[#eaf8f2] p-4 text-sm font-bold text-[#087754]">Funktionen uppdaterades.</p> : null}
      {params.trial === "1" ? <p className="rounded-card border border-[#cfe8d6] bg-[#eaf8f2] p-4 text-sm font-bold text-[#087754]">Testperioden är aktiverad i 14 dagar. Funktionen låses automatiskt efter perioden om planen inte uppgraderas.</p> : null}

      <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="border-b border-line px-5 py-4 sm:px-6">
          <h2 className="text-lg font-bold text-ink">Funktioner</h2>
          <p className="mt-1 text-sm leading-6 text-ink-muted">Se planstatus, aktivering och testperiod i samma lista.</p>
        </div>

        <div className="divide-y divide-line">
          {features.map((feature) => {
            const stateLabel = feature.accessState === "included"
              ? "Ingår i plan"
              : feature.accessState === "trial"
                ? "Testperiod aktiv"
                : feature.accessState === "disabled"
                  ? "Avstängd"
                  : "Låst";
            const stateTone = feature.accessState === "included"
              ? "bg-[#eaf8f2] text-[#087754]"
              : feature.accessState === "trial"
                ? "bg-[#fff7df] text-[#805d14]"
                : feature.accessState === "disabled"
                  ? "bg-[#eef5ff] text-[#1469d8]"
                  : "bg-surface-subtle text-ink-muted";

            return (
              <article key={feature.featureKey} className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-ink">{feature.name}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${stateTone}`}>{stateLabel}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-ink-muted">{feature.description}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-ink-muted">
                    <span>Minsta plan: <strong className="text-ink">{feature.minimumPlan}</strong></span>
                    {feature.trialEndsAt && feature.accessState === "trial" ? (
                      <span>Testperiod till: <strong className="text-ink">{new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium" }).format(new Date(feature.trialEndsAt))}</strong></span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {feature.accessState !== "locked" ? (
                    <form action={toggleFeature}>
                      <input type="hidden" name="featureKey" value={feature.featureKey} />
                      <input type="hidden" name="enabled" value={feature.workspaceEnabled ? "false" : "true"} />
                      <button className="min-h-10 rounded-control border border-line bg-surface px-4 py-2 text-sm font-bold text-brand-deep hover:bg-surface-subtle">
                        {feature.workspaceEnabled ? "Inaktivera" : "Aktivera"}
                      </button>
                    </form>
                  ) : null}

                  {feature.canStartTrial ? (
                    <form action={startTrial}>
                      <input type="hidden" name="featureKey" value={feature.featureKey} />
                      <button className="min-h-10 rounded-control bg-brand-deep px-4 py-2 text-sm font-bold text-white hover:bg-brand-hover">
                        Aktivera gratis i {feature.trialDays} dagar
                      </button>
                    </form>
                  ) : null}

                  {feature.accessState === "locked" && !feature.canStartTrial ? (
                    <a href="/dashboard/installningar#billing" className="inline-flex min-h-10 items-center rounded-control bg-brand-deep px-4 py-2 text-sm font-bold text-white hover:bg-brand-hover">
                      Uppgradera plan
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
