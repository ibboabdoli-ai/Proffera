"use client";

import { useMemo, useState } from "react";

import {
  BOOKING_THEME_KEYS,
  BOOKING_THEME_TEMPLATES,
  resolveBookingThemeContent,
  type BookingThemeContentOverrides,
  type BookingThemeKey,
} from "@/lib/booking-theme-templates";

type Draft = {
  heroTitleSv: string;
  heroTitleEn: string;
  heroSubtitleSv: string;
  heroSubtitleEn: string;
  heroDescriptionSv: string;
  heroDescriptionEn: string;
  ctaLabelSv: string;
  ctaLabelEn: string;
  faqTitleSv: string;
  faqTitleEn: string;
  faqBodySv: string;
  faqBodyEn: string;
  heroImageUrl: string;
};

type Props = {
  activeThemeKey: string;
  overrides: BookingThemeContentOverrides;
  saveAction: (formData: FormData) => Promise<void>;
};

function createDraft(themeKey: BookingThemeKey, overrides: BookingThemeContentOverrides): Draft {
  const sv = resolveBookingThemeContent(themeKey, "sv", overrides);
  const en = resolveBookingThemeContent(themeKey, "en", overrides);
  return {
    heroTitleSv: sv.heroTitle,
    heroTitleEn: en.heroTitle,
    heroSubtitleSv: sv.heroSubtitle,
    heroSubtitleEn: en.heroSubtitle,
    heroDescriptionSv: sv.heroDescription,
    heroDescriptionEn: en.heroDescription,
    ctaLabelSv: sv.ctaLabel,
    ctaLabelEn: en.ctaLabel,
    faqTitleSv: sv.faqTitle,
    faqTitleEn: en.faqTitle,
    faqBodySv: sv.faqBody,
    faqBodyEn: en.faqBody,
    heroImageUrl: sv.heroImageUrl,
  };
}

export function ThemeContentEditor({ activeThemeKey, overrides, saveAction }: Props) {
  const initialTheme: BookingThemeKey = BOOKING_THEME_KEYS.includes(activeThemeKey as BookingThemeKey)
    ? activeThemeKey as BookingThemeKey
    : "clean";
  const [themeKey, setThemeKey] = useState<BookingThemeKey>(initialTheme);
  const [drafts, setDrafts] = useState<Record<BookingThemeKey, Draft>>(() => Object.fromEntries(
    BOOKING_THEME_KEYS.map((key) => [key, createDraft(key, overrides)]),
  ) as Record<BookingThemeKey, Draft>);
  const draft = drafts[themeKey];
  const template = BOOKING_THEME_TEMPLATES[themeKey];

  const hasOverride = useMemo(() => Boolean(overrides[themeKey] && Object.keys(overrides[themeKey] ?? {}).length), [overrides, themeKey]);

  function change(field: keyof Draft, value: string) {
    setDrafts((current) => ({ ...current, [themeKey]: { ...current[themeKey], [field]: value } }));
  }

  return (
    <section className="rounded-[28px] border border-[#dfe6df] bg-white p-5 shadow-sm sm:p-6" data-theme-content-editor>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#68736b]">Central mall + dina ändringar</p>
          <h2 className="mt-2 text-xl font-black text-[#17201a]">Texter och standardbild</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#667168]">Varje tema har färdiga texter på svenska och engelska samt en relevant standardbild. Ändra bara det du vill anpassa för din arbetsyta.</p>
        </div>
        <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-black ${hasOverride ? "bg-[#fff4e8] text-[#8a5324]" : "bg-[#edf5ef] text-[#17452f]"}`}>
          {hasOverride ? "Anpassad" : "Central standard"}
        </span>
      </div>

      <form action={saveAction} className="mt-5 grid gap-5">
        <label className="grid gap-2 text-sm font-bold text-[#263129]">
          Tema
          <select name="themeContentKey" value={themeKey} onChange={(event) => setThemeKey(event.target.value as BookingThemeKey)} className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal">
            {BOOKING_THEME_KEYS.map((key) => <option key={key} value={key}>{BOOKING_THEME_TEMPLATES[key].name}</option>)}
          </select>
        </label>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="grid gap-4 rounded-2xl border border-[#e2e7e1] bg-[#fafbf9] p-4">
            <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#68736b]">Svenska</p><p className="mt-1 text-xs text-[#748078]">Visas när besökaren använder svenska.</p></div>
            <label className="grid gap-2 text-sm font-bold">Rubrik<input name="heroTitleSv" value={draft.heroTitleSv} onChange={(event) => change("heroTitleSv", event.target.value)} maxLength={180} className="rounded-xl border border-[#d7dfd7] bg-white px-4 py-3 font-normal" /></label>
            <label className="grid gap-2 text-sm font-bold">Underrubrik<input name="heroSubtitleSv" value={draft.heroSubtitleSv} onChange={(event) => change("heroSubtitleSv", event.target.value)} maxLength={220} className="rounded-xl border border-[#d7dfd7] bg-white px-4 py-3 font-normal" /></label>
            <label className="grid gap-2 text-sm font-bold">Beskrivning<textarea name="heroDescriptionSv" value={draft.heroDescriptionSv} onChange={(event) => change("heroDescriptionSv", event.target.value)} maxLength={1000} rows={4} className="rounded-xl border border-[#d7dfd7] bg-white px-4 py-3 font-normal" /></label>
            <label className="grid gap-2 text-sm font-bold">CTA<input name="ctaLabelSv" value={draft.ctaLabelSv} onChange={(event) => change("ctaLabelSv", event.target.value)} maxLength={80} className="rounded-xl border border-[#d7dfd7] bg-white px-4 py-3 font-normal" /></label>
            <label className="grid gap-2 text-sm font-bold">FAQ-fråga<input name="faqTitleSv" value={draft.faqTitleSv} onChange={(event) => change("faqTitleSv", event.target.value)} maxLength={220} className="rounded-xl border border-[#d7dfd7] bg-white px-4 py-3 font-normal" /></label>
            <label className="grid gap-2 text-sm font-bold">FAQ-svar<textarea name="faqBodySv" value={draft.faqBodySv} onChange={(event) => change("faqBodySv", event.target.value)} maxLength={1200} rows={3} className="rounded-xl border border-[#d7dfd7] bg-white px-4 py-3 font-normal" /></label>
          </div>

          <div className="grid gap-4 rounded-2xl border border-[#e2e7e1] bg-[#fafbf9] p-4">
            <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[#68736b]">English</p><p className="mt-1 text-xs text-[#748078]">Shown when the visitor uses English.</p></div>
            <label className="grid gap-2 text-sm font-bold">Headline<input name="heroTitleEn" value={draft.heroTitleEn} onChange={(event) => change("heroTitleEn", event.target.value)} maxLength={180} className="rounded-xl border border-[#d7dfd7] bg-white px-4 py-3 font-normal" /></label>
            <label className="grid gap-2 text-sm font-bold">Subheadline<input name="heroSubtitleEn" value={draft.heroSubtitleEn} onChange={(event) => change("heroSubtitleEn", event.target.value)} maxLength={220} className="rounded-xl border border-[#d7dfd7] bg-white px-4 py-3 font-normal" /></label>
            <label className="grid gap-2 text-sm font-bold">Description<textarea name="heroDescriptionEn" value={draft.heroDescriptionEn} onChange={(event) => change("heroDescriptionEn", event.target.value)} maxLength={1000} rows={4} className="rounded-xl border border-[#d7dfd7] bg-white px-4 py-3 font-normal" /></label>
            <label className="grid gap-2 text-sm font-bold">CTA<input name="ctaLabelEn" value={draft.ctaLabelEn} onChange={(event) => change("ctaLabelEn", event.target.value)} maxLength={80} className="rounded-xl border border-[#d7dfd7] bg-white px-4 py-3 font-normal" /></label>
            <label className="grid gap-2 text-sm font-bold">FAQ question<input name="faqTitleEn" value={draft.faqTitleEn} onChange={(event) => change("faqTitleEn", event.target.value)} maxLength={220} className="rounded-xl border border-[#d7dfd7] bg-white px-4 py-3 font-normal" /></label>
            <label className="grid gap-2 text-sm font-bold">FAQ answer<textarea name="faqBodyEn" value={draft.faqBodyEn} onChange={(event) => change("faqBodyEn", event.target.value)} maxLength={1200} rows={3} className="rounded-xl border border-[#d7dfd7] bg-white px-4 py-3 font-normal" /></label>
          </div>
        </div>

        <div className="grid gap-4 rounded-2xl border border-[#e2e7e1] p-4 lg:grid-cols-[1fr_260px] lg:items-end">
          <label className="grid gap-2 text-sm font-bold">Hero-bild URL<input name="themeHeroImageUrl" value={draft.heroImageUrl} onChange={(event) => change("heroImageUrl", event.target.value)} placeholder={template.heroImageUrl} className="rounded-xl border border-[#d7dfd7] px-4 py-3 font-normal" /></label>
          <div className="aspect-[16/10] overflow-hidden rounded-xl border border-[#e0e5dd] bg-[#f1f3f0]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={draft.heroImageUrl || template.heroImageUrl} alt="" className="h-full w-full object-cover" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="rounded-xl bg-[#173e2b] px-5 py-3 text-sm font-black text-white">Spara temainnehåll</button>
          <button name="resetThemeContent" value="1" className="rounded-xl border border-[#cad5cb] bg-white px-5 py-3 text-sm font-black text-[#17452f]">Återställ till central mall</button>
        </div>
      </form>
    </section>
  );
}
