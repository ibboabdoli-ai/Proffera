import Link from "next/link";
import { ArrowLeft, PencilLine } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import { DashboardPageHeader } from "@/components/dashboard/dashboard-page-ui";
import {
  getDashboardWorkspaceQuoteOffer,
  updateDashboardWorkspaceQuoteOfferDraft,
} from "@/lib/workspace-quote-offers-db";
import { validateWorkspaceQuoteOfferDraft } from "@/lib/workspace-quote-offer-draft";
import { canEditWorkspaceQuoteOffer } from "@/lib/workspace-quote-offer-policy";

export const dynamic = "force-dynamic";

type DashboardLocale = "sv" | "en";

const copy = {
  sv: {
    back: "Till offertförfrågan",
    eyebrow: "Redigera offertutkast",
    version: "Version",
    locked: "Den här offerten är låst och kan inte längre redigeras.",
    title: "Rubrik",
    amount: "Belopp exkl. moms",
    vat: "Moms (%)",
    validUntil: "Giltig till",
    terms: "Villkor",
    save: "Spara ändringar",
    invalid: "Kontrollera belopp, moms, rubrik och datum.",
    conflict: "Utkastet ändrades av någon annan. Ladda om sidan och försök igen.",
    saved: "Ändringarna sparades.",
  },
  en: {
    back: "Back to quote enquiry",
    eyebrow: "Edit offer draft",
    version: "Version",
    locked: "This offer is locked and can no longer be edited.",
    title: "Title",
    amount: "Amount excluding VAT",
    vat: "VAT (%)",
    validUntil: "Valid until",
    terms: "Terms",
    save: "Save changes",
    invalid: "Check the amount, VAT, title and date.",
    conflict: "The draft changed elsewhere. Reload the page and try again.",
    saved: "Changes saved.",
  },
} as const;

function localHref(href: string, locale: DashboardLocale, extra?: Record<string, string>) {
  const query = new URLSearchParams();
  if (locale === "en") query.set("lang", "en");
  for (const [key, value] of Object.entries(extra ?? {})) query.set(key, value);
  const suffix = query.toString();
  return suffix ? `${href}?${suffix}` : href;
}

function minorToInput(amountMinor: number) {
  return (amountMinor / 100).toFixed(2);
}

export default async function EditOfferDraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; offerId: string }>;
  searchParams?: Promise<{ lang?: string | string[]; state?: string | string[] }>;
}) {
  const [{ id, offerId }, query] = await Promise.all([params, searchParams]);
  const language = Array.isArray(query?.lang) ? query.lang[0] : query?.lang;
  const state = Array.isArray(query?.state) ? query.state[0] : query?.state;
  const locale: DashboardLocale = language === "en" ? "en" : "sv";
  const text = copy[locale];
  const foundOffer = await getDashboardWorkspaceQuoteOffer(id, offerId);
  if (!foundOffer) notFound();
  const offer = foundOffer;

  async function updateDraft(formData: FormData) {
    "use server";
    const result = validateWorkspaceQuoteOfferDraft({
      amount: formData.get("amount"),
      vatRate: formData.get("vatRate"),
      title: formData.get("title"),
      terms: formData.get("terms"),
      validUntil: formData.get("validUntil"),
      currency: offer.currency,
    });
    if (!result.ok) {
      redirect(localHref(`/dashboard/offerter/${id}/offer/${offerId}`, locale, { state: "invalid" }));
    }
    try {
      await updateDashboardWorkspaceQuoteOfferDraft(
        id,
        offerId,
        String(formData.get("expectedUpdatedAt") ?? ""),
        result.value,
      );
    } catch {
      redirect(localHref(`/dashboard/offerter/${id}/offer/${offerId}`, locale, { state: "conflict" }));
    }
    redirect(localHref(`/dashboard/offerter/${id}/offer/${offerId}`, locale, { state: "saved" }));
  }

  const editable = canEditWorkspaceQuoteOffer(offer.status);
  const message = state === "saved" ? text.saved : state === "conflict" ? text.conflict : state === "invalid" ? text.invalid : "";

  return (
    <div className="grid gap-6" lang={locale}>
      <Link href={localHref(`/dashboard/offerter/${id}`, locale)} className="inline-flex w-fit items-center gap-2 text-sm font-bold text-[#17452f]">
        <ArrowLeft className="h-4 w-4" />{text.back}
      </Link>
      <DashboardPageHeader eyebrow={text.eyebrow} title={`${offer.title} · ${text.version} ${offer.version}`} description={offer.currency} icon={PencilLine} />

      {message ? <p className={`rounded-xl px-4 py-3 text-sm font-semibold ${state === "saved" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{message}</p> : null}

      {!editable ? (
        <section className="rounded-3xl border border-[#ead9bf] bg-[#fff9ef] p-5 text-sm font-semibold text-[#7a5320] sm:p-6">{text.locked}</section>
      ) : (
        <section className="rounded-3xl border border-[#dbe3d8] bg-[#f7f9f6] p-5 sm:p-6">
          <form action={updateDraft} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="expectedUpdatedAt" value={offer.updatedAt} />
            <label className="grid gap-1.5 text-sm font-semibold"><span>{text.title}</span><input name="title" required maxLength={160} defaultValue={offer.title} className="min-h-11 rounded-xl border border-[#cfd8cf] bg-white px-3" /></label>
            <label className="grid gap-1.5 text-sm font-semibold"><span>{text.validUntil}</span><input name="validUntil" type="date" defaultValue={offer.validUntil} className="min-h-11 rounded-xl border border-[#cfd8cf] bg-white px-3" /></label>
            <label className="grid gap-1.5 text-sm font-semibold"><span>{text.amount} ({offer.currency})</span><input name="amount" required inputMode="decimal" defaultValue={minorToInput(offer.subtotalMinor)} className="min-h-11 rounded-xl border border-[#cfd8cf] bg-white px-3" /></label>
            <label className="grid gap-1.5 text-sm font-semibold"><span>{text.vat}</span><input name="vatRate" required inputMode="decimal" defaultValue={(offer.vatRateBasisPoints / 100).toString()} className="min-h-11 rounded-xl border border-[#cfd8cf] bg-white px-3" /></label>
            <label className="grid gap-1.5 text-sm font-semibold sm:col-span-2"><span>{text.terms}</span><textarea name="terms" maxLength={5000} rows={8} defaultValue={offer.terms} className="rounded-xl border border-[#cfd8cf] bg-white px-3 py-2" /></label>
            <button type="submit" className="min-h-11 w-fit rounded-xl bg-[#173e2b] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#0f3020]">{text.save}</button>
          </form>
        </section>
      )}
    </div>
  );
}
