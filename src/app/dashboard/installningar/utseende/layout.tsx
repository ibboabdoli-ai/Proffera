import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getWorkspaceExperienceSettings, updateWorkspaceExperienceSettings } from "@/lib/workspace-experience";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

const themePresets = [
  { key: "clean", name: "Clean", description: "Luftig, trygg och tydlig", primary: "#17452f", accent: "#d9b44a", appearance: "light" as const, shell: "bg-[#f7f7f4]", card: "rounded-2xl bg-white", button: "rounded-xl bg-[#17452f]" },
  { key: "salon", name: "Salon", description: "Mjuk och editorial för skönhet", primary: "#7b3651", accent: "#efb6c8", appearance: "light" as const, shell: "bg-[#fff5f7]", card: "rounded-[2rem] bg-white", button: "rounded-full bg-[#7b3651]" },
  { key: "premium", name: "Premium", description: "Mörk lyx med gulddetaljer", primary: "#111827", accent: "#d4af37", appearance: "dark" as const, shell: "bg-[#090d16]", card: "rounded-none border border-[#d4af37]/45 bg-[#111827]", button: "rounded-none bg-[#d4af37]" },
  { key: "modern", name: "Modern", description: "Färgstark, digital och modulär", primary: "#075e73", accent: "#38bdf8", appearance: "light" as const, shell: "bg-[#e8f7fb]", card: "rounded-lg bg-white", button: "rounded-lg bg-[#075e73]" },
  { key: "minimal", name: "Minimal", description: "Monokrom och typografisk", primary: "#111111", accent: "#b7b7b7", appearance: "light" as const, shell: "bg-white", card: "rounded-none border-y border-black bg-white", button: "rounded-none bg-black" },
] as const;

async function applyThemePreset(formData: FormData) {
  "use server";
  const themeKey = String(formData.get("themeKey") ?? "clean");
  const preset = themePresets.find((item) => item.key === themeKey);
  if (!preset) redirect("/dashboard/installningar/utseende?error=theme");

  const current = await getWorkspaceExperienceSettings();
  await updateWorkspaceExperienceSettings({
    ...current,
    themeKey: preset.key,
    primaryColor: preset.primary,
    accentColor: preset.accent,
    appearance: preset.appearance,
  });
  redirect("/dashboard/installningar/utseende?updated=1");
}

export default async function AppearanceLayout({ children }: { children: ReactNode }) {
  const [settings, access] = await Promise.all([getWorkspaceExperienceSettings(), getUserWorkspaceAccess()]);
  const previewHref = access.ok ? `/boka/${access.workspaceSlug}` : null;

  return <div className="grid gap-6">
    <section className="rounded-[26px] border border-[#dfe6df] bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[#68736b]">Färdiga bokningsteman</p><h2 className="mt-2 text-2xl font-black text-[#17201a]">Välj design med en klick</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[#667168]">Varje tema har egen layoutkänsla, typografi, hörn, kontrast och standardpalett. Färgerna kan finjusteras i formuläret nedanför.</p></div>{previewHref ? <a href={previewHref} target="_blank" rel="noreferrer" className="text-sm font-bold text-[#17452f]">Öppna bokningssidans förhandsvisning</a> : null}</div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {themePresets.map((theme) => {
          const active = settings.themeKey === theme.key;
          return <form action={applyThemePreset} key={theme.key} className={`overflow-hidden rounded-2xl border-2 ${active ? "border-[#17452f] shadow-md" : "border-[#e1e6df]"}`}>
            <input type="hidden" name="themeKey" value={theme.key} />
            <button className="block w-full text-left" aria-pressed={active}>
              <div className={`h-36 p-3 ${theme.shell}`}>
                <div style={{ background: theme.primary }} className="h-7 w-3/4" />
                <div className={`mt-3 p-3 shadow-sm ${theme.card}`}><div className="h-2 w-4/5 bg-black/15"/><div className="mt-2 h-2 w-3/5 bg-black/10"/><div className={`mt-4 h-7 w-2/3 ${theme.button}`} /></div>
              </div>
              <div className="p-4"><div className="flex items-center justify-between gap-2"><strong>{theme.name}</strong>{active ? <span className="rounded-full bg-[#eaf6ed] px-2 py-1 text-[10px] font-black text-[#17452f]">Vald</span> : null}</div><p className="mt-1 text-xs leading-5 text-[#667168]">{theme.description}</p><span className="mt-3 inline-block text-xs font-black text-[#17452f]">{active ? "Aktivt tema" : "Använd tema"}</span></div>
            </button>
          </form>;
        })}
      </div>
    </section>
    {children}
  </div>;
}
