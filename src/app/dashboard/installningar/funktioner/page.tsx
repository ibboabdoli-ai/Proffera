import { redirect } from "next/navigation";

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

  return <div className="grid gap-6">
    <header className="rounded-[28px] bg-[#173e2b] p-7 text-white">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">Funktioner och plan</p>
      <h1 className="mt-2 text-3xl font-bold">Aktivera det företaget behöver</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-white/80">Varje funktion styrs av arbetsytans plan, eventuell 14-dagars testperiod och ditt eget val. Inställningar sparas även när en testperiod tar slut.</p>
    </header>

    {params.updated === "1" ? <p className="rounded-xl bg-[#eaf6ed] p-4 text-sm font-bold text-[#17452f]">Funktionen uppdaterades.</p> : null}
    {params.trial === "1" ? <p className="rounded-xl bg-[#eaf6ed] p-4 text-sm font-bold text-[#17452f]">Testperioden är aktiverad i 14 dagar. Funktionen låses automatiskt efter perioden om planen inte uppgraderas.</p> : null}

    <section className="grid gap-4 lg:grid-cols-2">
      {features.map((feature) => {
        const stateLabel = feature.accessState === "included" ? "Ingår i plan" : feature.accessState === "trial" ? "Testperiod aktiv" : feature.accessState === "disabled" ? "Avstängd" : "Låst";
        return <article key={feature.featureKey} className="rounded-[24px] border border-[#dfe6df] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-xl font-bold text-[#17201a]">{feature.name}</h2><p className="mt-2 text-sm leading-6 text-[#5f6b63]">{feature.description}</p></div>
            <span className="rounded-full bg-[#edf5ef] px-3 py-1 text-xs font-bold text-[#17452f]">{stateLabel}</span>
          </div>
          <div className="mt-4 grid gap-1 text-xs text-[#6d776f]">
            <p>Minsta plan: <strong>{feature.minimumPlan}</strong></p>
            {feature.trialEndsAt && feature.accessState === "trial" ? <p>Testperiod till: <strong>{new Intl.DateTimeFormat("sv-SE", { dateStyle: "medium" }).format(new Date(feature.trialEndsAt))}</strong></p> : null}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {feature.accessState !== "locked" ? <form action={toggleFeature}>
              <input type="hidden" name="featureKey" value={feature.featureKey} />
              <input type="hidden" name="enabled" value={feature.workspaceEnabled ? "false" : "true"} />
              <button className="min-h-10 rounded-xl border border-[#cfd9d0] px-4 py-2 text-sm font-bold text-[#17452f]">{feature.workspaceEnabled ? "Inaktivera" : "Aktivera"}</button>
            </form> : null}
            {feature.canStartTrial ? <form action={startTrial}>
              <input type="hidden" name="featureKey" value={feature.featureKey} />
              <button className="min-h-10 rounded-xl bg-[#173e2b] px-4 py-2 text-sm font-bold text-white">Aktivera gratis i {feature.trialDays} dagar</button>
            </form> : null}
            {feature.accessState === "locked" && !feature.canStartTrial ? <a href="/dashboard/installningar#billing" className="inline-flex min-h-10 items-center rounded-xl bg-[#173e2b] px-4 py-2 text-sm font-bold text-white">Uppgradera plan</a> : null}
          </div>
        </article>;
      })}
    </section>
  </div>;
}
