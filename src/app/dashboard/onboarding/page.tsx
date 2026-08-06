import { redirect } from "next/navigation";

import { seedWorkspaceServicesForIndustry } from "@/lib/workspace-service-seeding";
import { getWorkspaceOnboarding, updateWorkspaceOnboarding } from "@/lib/workspace-experience";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const dynamic = "force-dynamic";

const steps = ["company", "industry", "theme", "services", "hours", "staff", "booking", "chatbot", "publish"] as const;

async function saveOnboarding(formData: FormData) {
  "use server";
  const industryKey = String(formData.get("industryKey") ?? "other");
  const currentStep = String(formData.get("currentStep") ?? "company");
  const completedSteps = String(formData.get("completedSteps") ?? "").split(",").filter(Boolean);
  const isComplete = formData.get("isComplete") === "true";
  const seeded = await seedWorkspaceServicesForIndustry(industryKey);
  await updateWorkspaceOnboarding({ industryKey: seeded.industryKey, currentStep, completedSteps, isComplete });
  redirect(isComplete ? "/dashboard?onboarding=complete" : `/dashboard/onboarding?saved=1&services=${seeded.created}`);
}

export default async function OnboardingPage({ searchParams }: { searchParams?: Promise<{ saved?: string; services?: string }> }) {
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) redirect("/dashboard");
  const onboarding = await getWorkspaceOnboarding();
  const params = searchParams ? await searchParams : {};
  const completed = new Set(onboarding.completedSteps);
  const createdServices = Math.max(0, Number(params.services) || 0);

  return <div className="grid gap-6">
    <header className="rounded-[28px] bg-[#173e2b] p-7 text-white"><p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">Kom igång</p><h1 className="mt-2 text-3xl font-bold">Konfigurera arbetsytan utan kod</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-white/80">Följ stegen en gång. Proffera skapar därefter bokningssida, standardinställningar och tillgängliga funktioner automatiskt för arbetsytan.</p></header>
    {params.saved === "1" ? <p className="rounded-xl bg-[#eaf6ed] p-4 text-sm font-bold text-[#17452f]">{createdServices > 0 ? `${createdServices} rekommenderade tjänster skapades automatiskt. Du kan nu ändra pris, längd och namn.` : "Onboarding sparades. Befintliga tjänster behölls utan ändringar."}</p> : null}
    <form action={saveOnboarding} className="grid gap-6">
      <section className="rounded-[24px] border border-[#dfe6df] bg-white p-6"><h2 className="text-xl font-bold">Bransch</h2><p className="mt-2 text-sm text-[#667168]">När arbetsytan ännu saknar tjänster skapar Proffera automatiskt ett färdigt startpaket för den valda branschen. Befintliga tjänster skrivs aldrig över.</p><select name="industryKey" defaultValue={onboarding.industryKey} className="mt-4 w-full rounded-xl border border-[#d7dfd7] px-4 py-3"><option value="salon">Salong och skönhet</option><option value="cleaning">Städning</option><option value="window_cleaning">Fönsterputs</option><option value="consulting">Konsult</option><option value="repair">Reparation och service</option><option value="healthcare">Hälsa</option><option value="restaurant">Restaurang</option><option value="other">Annat</option></select></section>
      <section className="rounded-[24px] border border-[#dfe6df] bg-white p-6"><h2 className="text-xl font-bold">Checklista</h2><div className="mt-4 grid gap-3 md:grid-cols-2">{steps.map((step, index) => <label key={step} className="flex items-center gap-3 rounded-xl border border-[#e0e5dd] p-4"><input type="checkbox" name={`step_${step}`} defaultChecked={completed.has(step)} className="h-5 w-5" disabled /><span><strong>{index + 1}. {step}</strong><small className="mt-1 block text-[#6d776f]">{completed.has(step) ? "Klart" : step === onboarding.currentStep ? "Nuvarande steg" : "Återstår"}</small></span></label>)}</div></section>
      <input type="hidden" name="currentStep" value={onboarding.currentStep} />
      <input type="hidden" name="completedSteps" value={onboarding.completedSteps.join(",")} />
      <input type="hidden" name="isComplete" value={onboarding.isComplete ? "true" : "false"} />
      <div className="flex flex-wrap gap-3"><button className="inline-flex min-h-11 items-center rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-bold text-white">Spara bransch och skapa starttjänster</button><a href="/dashboard/installningar" className="inline-flex min-h-11 items-center rounded-xl border border-[#cfd9d0] px-5 py-3 text-sm font-bold text-[#17452f]">Fortsätt med företagsprofil</a><a href="/dashboard/installningar/utseende" className="inline-flex min-h-11 items-center rounded-xl border border-[#cfd9d0] px-5 py-3 text-sm font-bold text-[#17452f]">Välj tema</a><a href="/dashboard/installningar/funktioner" className="inline-flex min-h-11 items-center rounded-xl border border-[#cfd9d0] px-5 py-3 text-sm font-bold text-[#17452f]">Välj funktioner</a></div>
    </form>
  </div>;
}
