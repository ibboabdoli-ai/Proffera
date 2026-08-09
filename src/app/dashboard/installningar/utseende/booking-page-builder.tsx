"use client";

import { useMemo, useState } from "react";

import {
  bookingThemeAppearanceIsFixed,
  normalizeBookingThemeAppearance,
  readableBookingTextColor,
} from "@/lib/booking-theme-contract";

type BuilderSettings = {
  themeKey: string;
  primaryColor: string;
  accentColor: string;
  appearance: "light" | "dark";
  defaultLanguage: "sv" | "en";
  swedishEnabled: boolean;
  englishEnabled: boolean;
  heroEnabled: boolean;
  servicesEnabled: boolean;
  staffEnabled: boolean;
  reviewsEnabled: boolean;
  galleryEnabled: boolean;
  contactEnabled: boolean;
  faqEnabled: boolean;
  chatbotEnabled: boolean;
  logoUrl: string;
  heroImageUrl: string;
  heroVideoUrl: string;
  customDomain: string;
  customDomainStatus: string;
};

type SectionKey =
  | "heroEnabled"
  | "servicesEnabled"
  | "staffEnabled"
  | "reviewsEnabled"
  | "galleryEnabled"
  | "contactEnabled"
  | "faqEnabled"
  | "chatbotEnabled";

type Props = {
  settings: BuilderSettings;
  builderEnabled: boolean;
  customDomainEnabled: boolean;
  domainConnected: boolean;
  publicBookingUrl: string;
  workspaceName: string;
  saveAction: (formData: FormData) => Promise<void>;
};

type Tab = "design" | "content" | "domain";
type Device = "desktop" | "tablet" | "mobile";

const templates = [
  { key: "clean", name: "Clean", description: "Ljus och trygg", primary: "#17452f", accent: "#d9b44a", appearance: "light" as const },
  { key: "modern", name: "Modern", description: "Digital och tydlig", primary: "#0b6678", accent: "#8fcbd6", appearance: "light" as const },
  { key: "salon", name: "Salon", description: "Mjuk och personlig", primary: "#843a5a", accent: "#e8b7ca", appearance: "light" as const },
  { key: "premium", name: "Premium", description: "Mörk och exklusiv", primary: "#17130f", accent: "#b69257", appearance: "dark" as const },
  { key: "minimal", name: "Minimal", description: "Ren och avskalad", primary: "#184f39", accent: "#d6e3db", appearance: "light" as const },
  { key: "restaurant", name: "Restaurant", description: "Varm och elegant", primary: "#5b2a1d", accent: "#d9aa68", appearance: "dark" as const },
] as const;

const sections: Array<{ key: SectionKey; label: string; helper: string }> = [
  { key: "heroEnabled", label: "Hero", helper: "Företagsnamn, plats och första intrycket" },
  { key: "servicesEnabled", label: "Tjänster", helper: "Tjänster, tid och pris före bokning" },
  { key: "staffEnabled", label: "Medarbetare", helper: "Visa personal när den används i bokningen" },
  { key: "reviewsEnabled", label: "Omdömen", helper: "Verifierade och godkända kundomdömen" },
  { key: "galleryEnabled", label: "Galleri", helper: "Bilder som bygger förtroende" },
  { key: "contactEnabled", label: "Kontakt", helper: "E-post, telefon och kontaktvägar" },
  { key: "faqEnabled", label: "FAQ", helper: "Vanliga frågor före bokningen" },
  { key: "chatbotEnabled", label: "AI-chatt", helper: "AI-assistent på den publika bokningssidan" },
];

function PreviewCard({ children, dark }: { children: React.ReactNode; dark: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${dark ? "border-white/10 bg-white/[0.06]" : "border-black/10 bg-white"}`}>
      {children}
    </div>
  );
}

export function BookingPageBuilder({
  settings,
  builderEnabled,
  customDomainEnabled,
  domainConnected,
  publicBookingUrl,
  workspaceName,
  saveAction,
}: Props) {
  const [tab, setTab] = useState<Tab>("design");
  const [device, setDevice] = useState<Device>("desktop");
  const [themeKey, setThemeKey] = useState(settings.themeKey);
  const [appearance, setAppearance] = useState(() => normalizeBookingThemeAppearance(settings.themeKey, settings.appearance));
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [accentColor, setAccentColor] = useState(settings.accentColor);
  const [swedishEnabled, setSwedishEnabled] = useState(settings.swedishEnabled);
  const [englishEnabled, setEnglishEnabled] = useState(settings.englishEnabled);
  const [defaultLanguage, setDefaultLanguage] = useState(settings.defaultLanguage);
  const [sectionState, setSectionState] = useState<Record<SectionKey, boolean>>(() => ({
    heroEnabled: settings.heroEnabled,
    servicesEnabled: settings.servicesEnabled,
    staffEnabled: settings.staffEnabled,
    reviewsEnabled: settings.reviewsEnabled,
    galleryEnabled: settings.galleryEnabled,
    contactEnabled: settings.contactEnabled,
    faqEnabled: settings.faqEnabled,
    chatbotEnabled: settings.chatbotEnabled,
  }));

  const previewWidth = device === "desktop" ? "max-w-[920px]" : device === "tablet" ? "max-w-[660px]" : "max-w-[390px]";
  const resolvedAppearance = normalizeBookingThemeAppearance(themeKey, appearance);
  const fixedAppearance = bookingThemeAppearanceIsFixed(themeKey);
  const dark = resolvedAppearance === "dark";
  const primaryText = useMemo(() => readableBookingTextColor(primaryColor), [primaryColor]);
  const accentText = useMemo(() => readableBookingTextColor(accentColor), [accentColor]);

  function applyTemplate(template: (typeof templates)[number]) {
    setThemeKey(template.key);
    setAppearance(normalizeBookingThemeAppearance(template.key, template.appearance));
    setPrimaryColor(template.primary);
    setAccentColor(template.accent);
  }

  function setSection(key: SectionKey, enabled: boolean) {
    setSectionState((current) => ({ ...current, [key]: enabled }));
  }

  const publicLabel = publicBookingUrl ? publicBookingUrl.replace(/^https?:\/\//, "") : "Public booking URL saknas";

  return (
    <form action={saveAction} className={builderEnabled ? "grid gap-5" : "pointer-events-none grid gap-5 opacity-55"} data-booking-page-builder>
      <input type="hidden" name="themeKey" value={themeKey} />
      <input type="hidden" name="appearance" value={resolvedAppearance} />
      <input type="hidden" name="primaryColor" value={primaryColor} />
      <input type="hidden" name="accentColor" value={accentColor} />
      <input type="hidden" name="defaultLanguage" value={defaultLanguage} />
      {swedishEnabled ? <input type="hidden" name="swedishEnabled" value="on" /> : null}
      {englishEnabled ? <input type="hidden" name="englishEnabled" value="on" /> : null}
      {sections.map(({ key }) => sectionState[key] ? <input key={key} type="hidden" name={key} value="on" /> : null)}

      <div className="flex flex-col gap-3 rounded-[24px] border border-[#dfe6df] bg-white p-3 shadow-sm xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2" aria-label="Builder tabs">
          {([
            ["design", "Design"],
            ["content", "Innehåll"],
            ["domain", "Domän"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-xl px-4 py-2.5 text-sm font-black ${tab === key ? "bg-[#173e2b] text-white" : "text-[#445149] hover:bg-[#f2f5f1]"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-[#f2f5f1] p-1" aria-label="Preview size">
            {(["desktop", "tablet", "mobile"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDevice(value)}
                className={`rounded-lg px-3 py-2 text-xs font-bold capitalize ${device === value ? "bg-white text-[#173e2b] shadow-sm" : "text-[#68736b]"}`}
              >
                {value}
              </button>
            ))}
          </div>
          {publicBookingUrl ? (
            <a href={publicBookingUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-[#cbd7cc] bg-white px-4 py-2.5 text-sm font-bold text-[#17452f]">
              Öppna bokningssidan
            </a>
          ) : null}
          <button className="rounded-xl bg-[#173e2b] px-5 py-2.5 text-sm font-black text-white shadow-sm">Spara & publicera</button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="grid content-start gap-4">
          {tab === "design" ? (
            <>
              <section className="rounded-[24px] border border-[#dfe6df] bg-white p-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#68736b]">Startmall</p>
                <h2 className="mt-2 text-lg font-black text-[#17201a]">Välj känsla</h2>
                <p className="mt-1 text-xs leading-5 text-[#667168]">Mallen är en professionell startpunkt. Du kan sedan ändra färger och innehåll.</p>
                <div className="mt-4 grid gap-2">
                  {templates.map((template) => (
                    <button
                      key={template.key}
                      type="button"
                      onClick={() => applyTemplate(template)}
                      className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${themeKey === template.key ? "border-[#17452f] bg-[#f0f6f2] ring-1 ring-[#17452f]" : "border-[#e0e5dd] hover:bg-[#f8faf7]"}`}
                    >
                      <span className="h-9 w-9 rounded-xl border border-black/10" style={{ background: `linear-gradient(135deg, ${template.primary} 0 64%, ${template.accent} 64%)` }} />
                      <span>
                        <span className="block text-sm font-black text-[#17201a]">{template.name}</span>
                        <span className="block text-xs text-[#68736b]">{template.description}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-[24px] border border-[#dfe6df] bg-white p-5">
                <h2 className="text-lg font-black text-[#17201a]">Varumärke</h2>
                <div className="mt-4 grid gap-4">
                  <label className="grid gap-2 text-sm font-bold text-[#263129]">Primär färg<input type="color" value={primaryColor} onChange={(event) => setPrimaryColor(event.target.value)} className="h-12 w-full rounded-xl border border-[#d7dfd7] p-1" /></label>
                  <label className="grid gap-2 text-sm font-bold text-[#263129]">Accentfärg<input type="color" value={accentColor} onChange={(event) => setAccentColor(event.target.value)} className="h-12 w-full rounded-xl border border-[#d7dfd7] p-1" /></label>
                  <label className="grid gap-2 text-sm font-bold text-[#263129]">
                    Läge
                    <select
                      value={resolvedAppearance}
                      disabled={fixedAppearance}
                      onChange={(event) => setAppearance(event.target.value === "dark" ? "dark" : "light")}
                      className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal disabled:cursor-not-allowed disabled:bg-[#f2f4f1] disabled:text-[#667168]"
                    >
                      <option value="light">Ljust</option>
                      <option value="dark">Mörkt</option>
                    </select>
                    {fixedAppearance ? <span className="text-xs font-normal leading-5 text-[#68736b]">Det här temat använder ett fast läge för att behålla rätt kontrast och design.</span> : null}
                  </label>
                </div>
              </section>
            </>
          ) : null}

          {tab === "content" ? (
            <>
              <section className="rounded-[24px] border border-[#dfe6df] bg-white p-5">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[#68736b]">Sektioner</p>
                <h2 className="mt-2 text-lg font-black text-[#17201a]">Vad ska visas?</h2>
                <div className="mt-4 grid gap-2">
                  {sections.map(({ key, label, helper }) => (
                    <label key={key} className="flex cursor-pointer items-start justify-between gap-3 rounded-2xl border border-[#e0e5dd] p-3 hover:bg-[#f8faf7]">
                      <span>
                        <span className="block text-sm font-black text-[#17201a]">{label}</span>
                        <span className="mt-0.5 block text-xs leading-4 text-[#68736b]">{helper}</span>
                      </span>
                      <input type="checkbox" checked={sectionState[key]} onChange={(event) => setSection(key, event.target.checked)} className="mt-1 h-5 w-5 accent-[#17452f]" />
                    </label>
                  ))}
                </div>
              </section>

              <section className="rounded-[24px] border border-[#dfe6df] bg-white p-5">
                <h2 className="text-lg font-black text-[#17201a]">Språk</h2>
                <div className="mt-4 grid gap-3">
                  <label className="flex items-center justify-between rounded-xl border border-[#e0e5dd] p-3 text-sm font-bold"><span>Svenska</span><input type="checkbox" checked={swedishEnabled} onChange={(event) => setSwedishEnabled(event.target.checked)} className="h-5 w-5 accent-[#17452f]" /></label>
                  <label className="flex items-center justify-between rounded-xl border border-[#e0e5dd] p-3 text-sm font-bold"><span>English</span><input type="checkbox" checked={englishEnabled} onChange={(event) => setEnglishEnabled(event.target.checked)} className="h-5 w-5 accent-[#17452f]" /></label>
                  <label className="grid gap-2 text-sm font-bold">Standardspråk<select value={defaultLanguage} onChange={(event) => setDefaultLanguage(event.target.value === "en" ? "en" : "sv")} className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal"><option value="sv" disabled={!swedishEnabled}>Svenska</option><option value="en" disabled={!englishEnabled}>English</option></select></label>
                  {!swedishEnabled && !englishEnabled ? <p className="rounded-xl bg-[#fff3ef] p-3 text-xs font-bold text-[#8f2f1b]">Minst ett språk måste vara aktivt innan du sparar.</p> : null}
                </div>
              </section>

              <section className="rounded-[24px] border border-[#dfe6df] bg-white p-5">
                <h2 className="text-lg font-black text-[#17201a]">Media</h2>
                <div className="mt-4 grid gap-3">
                  <label className="grid gap-2 text-sm font-bold">Logotyp URL<input name="logoUrl" defaultValue={settings.logoUrl} placeholder="https://..." className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal" /></label>
                  <label className="grid gap-2 text-sm font-bold">Hero-bild URL<input name="heroImageUrl" defaultValue={settings.heroImageUrl} placeholder="https://..." className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal" /></label>
                  <label className="grid gap-2 text-sm font-bold">Hero-video URL<input name="heroVideoUrl" defaultValue={settings.heroVideoUrl} placeholder="https://..." className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal" /></label>
                </div>
              </section>
            </>
          ) : null}

          {tab === "domain" ? (
            <section className="rounded-[24px] border border-[#dfe6df] bg-white p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#68736b]">Publicering</p>
              <h2 className="mt-2 text-lg font-black text-[#17201a]">Domän & adress</h2>
              <div className="mt-4 rounded-2xl bg-[#f4f7f3] p-4">
                <p className="text-xs font-bold text-[#68736b]">Din Proffera-adress</p>
                <p className="mt-1 break-all text-sm font-black text-[#17452f]">{publicLabel}</p>
                {publicBookingUrl ? <a href={publicBookingUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-black text-[#17452f] underline underline-offset-4">Öppna adressen</a> : null}
              </div>
              <label className="mt-4 grid gap-2 text-sm font-bold">
                Egen domän
                <input
                  name="customDomain"
                  defaultValue={settings.customDomain}
                  placeholder="booking.foretagen.se"
                  disabled={!customDomainEnabled}
                  className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal disabled:cursor-not-allowed disabled:bg-[#f2f4f1] disabled:text-[#7a857d]"
                />
              </label>
              <div className="mt-3 flex items-center gap-2 text-xs font-bold">
                <span className={`h-2.5 w-2.5 rounded-full ${settings.customDomain && domainConnected ? "bg-[#2f8b57]" : "bg-[#d29b32]"}`} />
                {settings.customDomain ? (domainConnected ? "Egen domän ansluten" : "Egen domän väntar på anslutning") : "Ingen egen domän ansluten"}
              </div>
              <p className="mt-3 text-xs leading-5 text-[#667168]">
                {customDomainEnabled
                  ? "Spara en domän du redan äger. Proffera ansluter den via Vercel och visar DNS-stegen om något saknas."
                  : "Egen domän är inte tillgänglig i nuvarande plan. Din Proffera-adress fortsätter fungera."}
              </p>
              {!customDomainEnabled ? <a href="/dashboard/installningar/funktioner" className="mt-3 inline-flex text-sm font-black text-[#17452f] underline underline-offset-4">Visa domänåtkomst</a> : null}
              <div className="mt-5 rounded-2xl border border-dashed border-[#d5ddd4] p-4">
                <p className="text-sm font-black text-[#17201a]">Köp domän via Proffera</p>
                <p className="mt-1 text-xs leading-5 text-[#68736b]">Planerad nästa fas: sök, köp och automatisk DNS/SSL direkt i Proffera. Ingen köpknapp visas innan registrar-integrationen är klar.</p>
              </div>
            </section>
          ) : null}
        </aside>

        <main className="min-w-0 rounded-[28px] border border-[#dfe6df] bg-[#eef2ed] p-3 sm:p-5" data-booking-builder-preview>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#68736b]">Live design preview</p>
              <p className="mt-1 text-sm text-[#5f6b63]">Ändringar visas här direkt. Spara för att publicera dem på den riktiga bokningssidan.</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#5f6b63] shadow-sm">{themeKey} · {resolvedAppearance}</span>
          </div>

          <div className={`mx-auto overflow-hidden rounded-[26px] shadow-xl transition-all ${previewWidth}`} style={{ backgroundColor: dark ? "#0e110f" : "#f7f7f4", color: dark ? "#ffffff" : "#17201a" }}>
            {sectionState.heroEnabled ? (
              <section className="p-5 sm:p-7" style={{ backgroundColor: primaryColor, color: primaryText }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-70">Boka online</p>
                    <h2 className="mt-2 text-2xl font-black">{workspaceName}</h2>
                    <p className="mt-2 text-xs font-semibold opacity-80">Din professionella bokningssida</p>
                  </div>
                  <div className="flex gap-1.5">
                    {swedishEnabled ? <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#17201a]">Svenska</span> : null}
                    {englishEnabled ? <span className="rounded-full border border-white/30 px-2.5 py-1 text-[10px] font-black">English</span> : null}
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2 text-[10px] font-bold">
                  {sectionState.reviewsEnabled ? <span className="rounded-full bg-white/10 px-3 py-2">★★★★★ Verifierade omdömen</span> : null}
                  <span className="rounded-full bg-white/10 px-3 py-2">Säker onlinebokning</span>
                </div>
              </section>
            ) : null}

            <div className={`grid gap-3 p-4 sm:p-5 ${device === "desktop" ? "md:grid-cols-[1.35fr_.65fr]" : ""}`}>
              <div className="grid content-start gap-3">
                <PreviewCard dark={dark}>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] opacity-55">Bokning</p>
                  <h3 className="mt-2 text-lg font-black">Välj tjänst</h3>
                  <p className="mt-1 text-xs opacity-65">Tjänst → Tid → Uppgifter</p>
                  <div className="mt-4 grid gap-2">
                    {["Populär tjänst", "Nästa tjänst"].map((label, index) => (
                      <div key={label} className={`rounded-xl border p-3 ${dark ? "border-white/10" : "border-black/10"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div><p className="text-sm font-black">{label}</p><p className="mt-1 text-[11px] opacity-60">{index ? "45 min" : "30 min"} · Pris på förfrågan</p></div>
                          <span className="rounded-full px-2 py-1 text-[10px] font-black" style={{ backgroundColor: accentColor, color: accentText }}>Ledig</span>
                        </div>
                        <button type="button" className="mt-3 w-full rounded-lg px-3 py-2 text-xs font-black" style={{ backgroundColor: primaryColor, color: primaryText }}>Boka</button>
                      </div>
                    ))}
                  </div>
                </PreviewCard>

                {sectionState.reviewsEnabled ? (
                  <PreviewCard dark={dark}>
                    <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.15em] opacity-55">Omdömen</p><h3 className="mt-1 text-base font-black">★★★★★ 5,0</h3></div><span className="text-[10px] font-bold opacity-55">Verifierad kund</span></div>
                    <p className="mt-3 text-xs leading-5 opacity-75">“Mycket bra service. Smidig bokning och bra bemötande.”</p>
                  </PreviewCard>
                ) : null}

                {sectionState.galleryEnabled ? <PreviewCard dark={dark}><p className="text-sm font-black">Galleri</p><div className="mt-3 grid grid-cols-3 gap-2">{[1,2,3].map((item) => <div key={item} className={`aspect-square rounded-xl ${dark ? "bg-white/10" : "bg-black/[0.06]"}`} />)}</div></PreviewCard> : null}
              </div>

              <div className="grid content-start gap-3">
                {sectionState.servicesEnabled ? <PreviewCard dark={dark}><p className="text-sm font-black">Tjänster</p><div className="mt-3 grid gap-2 text-xs">{["Tjänst 1", "Tjänst 2", "Tjänst 3"].map((item) => <div key={item} className={`rounded-xl px-3 py-2.5 ${dark ? "bg-white/[0.05]" : "bg-black/[0.035]"}`}>{item}</div>)}</div></PreviewCard> : null}
                {sectionState.staffEnabled ? <PreviewCard dark={dark}><p className="text-sm font-black">Medarbetare</p><p className="mt-2 text-xs opacity-65">Kunden kan välja ansvarig när tjänsten stödjer det.</p></PreviewCard> : null}
                {sectionState.contactEnabled ? <PreviewCard dark={dark}><p className="text-sm font-black">Kontakt</p><p className="mt-2 text-xs opacity-65">E-post · Telefon · Plats</p></PreviewCard> : null}
                {sectionState.faqEnabled ? <PreviewCard dark={dark}><p className="text-sm font-black">Vanliga frågor</p><p className="mt-2 text-xs font-bold">När blir bokningen klar?</p><p className="mt-1 text-[11px] opacity-60">Efter verifiering och företagets bokningsregler.</p></PreviewCard> : null}
                {sectionState.chatbotEnabled ? <div className="rounded-2xl p-4 text-xs font-black shadow-sm" style={{ backgroundColor: accentColor, color: accentText }}>AI-assistent · Fråga oss</div> : null}
              </div>
            </div>
          </div>
        </main>
      </div>
    </form>
  );
}
