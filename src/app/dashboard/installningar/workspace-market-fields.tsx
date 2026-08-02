"use client";

import { useState } from "react";

import {
  getWorkspaceMarketCountry,
  workspaceMarketCountries,
  workspaceTimeZones,
  type WorkspaceTimeZone,
} from "@/lib/workspace-market";

type WorkspaceMarketFieldsProps = {
  countryCode: string;
  timeZone: WorkspaceTimeZone;
  vatNumber: string;
  locale: "sv" | "en";
};

export function WorkspaceMarketFields({ countryCode: initialCountryCode, timeZone: initialTimeZone, vatNumber, locale }: WorkspaceMarketFieldsProps) {
  const initialCountry = getWorkspaceMarketCountry(initialCountryCode) ?? workspaceMarketCountries[0];
  const [countryCode, setCountryCode] = useState(initialCountry.code);
  const [timeZone, setTimeZone] = useState<WorkspaceTimeZone>(initialTimeZone);
  const country = getWorkspaceMarketCountry(countryCode) ?? initialCountry;
  const isEnglish = locale === "en";

  function selectCountry(nextCountryCode: string) {
    const nextCountry = getWorkspaceMarketCountry(nextCountryCode);
    if (!nextCountry) return;
    setCountryCode(nextCountry.code);
    setTimeZone(nextCountry.defaultTimeZone);
  }

  return (
    <fieldset className="grid gap-4 rounded-2xl border border-[#dce5dc] bg-[#f7f9f6] p-4">
      <legend className="px-1 text-sm font-bold text-[#17201a]">{isEnglish ? "Market and billing" : "Marknad och betalning"}</legend>
      <p className="text-xs leading-5 text-[#5b665f]">
        {isEnglish
          ? "These settings keep booking times and Stripe checkout aligned with your business. Stripe confirms the final payable currency and tax at checkout."
          : "Inställningarna håller bokningstider och Stripe Checkout anpassade till företaget. Stripe bekräftar slutligt belopp, valuta och skatt i kassan."}
      </p>

      <label className="grid gap-2 text-sm font-semibold text-[#344139]">
        {isEnglish ? "Business country / market" : "Företagets land / marknad"}
        <select name="billing_country_code" value={countryCode} onChange={(event) => selectCountry(event.target.value)} className="rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/15">
          {workspaceMarketCountries.map((option) => <option key={option.code} value={option.code}>{locale === "en" ? option.labelEn : option.labelSv}</option>)}
        </select>
      </label>

      <label className="grid gap-2 text-sm font-semibold text-[#344139]">
        {isEnglish ? "Business time zone" : "Företagets tidszon"}
        <select name="time_zone" value={timeZone} onChange={(event) => setTimeZone(event.target.value as WorkspaceTimeZone)} className="rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/15">
          {workspaceTimeZones.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>

      <label className="grid gap-2 text-sm font-semibold text-[#344139]">
        {isEnglish ? "Billing currency" : "Faktureringsvaluta"}
        <output className="rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-sm font-normal text-[#17201a]">{country.currency}</output>
        <input type="hidden" name="billing_currency" value={country.currency} />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-[#344139]">
        {isEnglish ? "VAT number (optional)" : "VAT-nummer (valfritt)"}
        <input name="vat_number" type="text" maxLength={32} defaultValue={vatNumber} placeholder={isEnglish ? "For example, GB123456789" : "Till exempel, SE123456789001"} className="rounded-xl border border-[#d9e1d7] bg-white px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/15" />
      </label>

      <p className="text-xs leading-5 text-[#5b665f]">
        {isEnglish
          ? "B2B only: collect the company VAT number before checkout. Tax is only calculated after the relevant Stripe Tax registrations are configured."
          : "Endast B2B: samla in företagets VAT-nummer före Checkout. Skatt beräknas först när relevanta Stripe Tax-registreringar är konfigurerade."}
      </p>
    </fieldset>
  );
}
