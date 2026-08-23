import Link from "next/link";
import { ArrowRight, BadgeCheck, Building2 } from "lucide-react";

import type { PublicLocale } from "@/lib/public-locale";

const copy = {
  sv: {
    eyebrow: "Ni fick en kundförfrågan via Proffera",
    title: "Det här är er företagsprofil",
    body: "Verifiera företaget med samma företagsmejl som tog emot förfrågan. När den säkra Marketplace-kopplingen kan bekräftas öppnar Proffera er workspace automatiskt, så att ni kan hantera kommande kundförfrågningar där.",
    action: "Verifiera företaget",
    note: "Om uppgifterna inte kan matchas säkert går anspråket vidare till manuell granskning. Ingen får åtkomst bara genom att öppna den här sidan.",
  },
  en: {
    eyebrow: "You received a customer request through Proffera",
    title: "This is your business profile",
    body: "Verify the business using the same business email address that received the request. When Proffera can confirm the secure Marketplace link, your workspace opens automatically so future customer requests can be managed there.",
    action: "Verify this business",
    note: "If the details cannot be matched safely, the claim stays in manual review. Opening this page alone never grants access.",
  },
} as const;

export function MarketplaceProfileClaimPrompt({ slug, locale }: { slug: string; locale: PublicLocale }) {
  const t = copy[locale];
  const claimHref = locale === "en"
    ? `/en/companies/claim/${encodeURIComponent(slug)}`
    : `/foretag/claim/${encodeURIComponent(slug)}`;

  return (
    <section lang={locale} className="bg-[#eef6f0] px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 rounded-2xl border border-[#c9dfcf] bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e4f2e8] text-[#17452f]">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#4d7359]"><BadgeCheck className="h-4 w-4" /> {t.eyebrow}</p>
            <h2 className="mt-1 text-xl font-black text-[#17201a]">{t.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5b665f]">{t.body}</p>
            <p className="mt-2 text-xs leading-5 text-[#727b74]">{t.note}</p>
          </div>
        </div>
        <Link href={claimHref} className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-xl bg-[#17452f] px-5 text-sm font-black text-white transition hover:bg-[#103824]">
          {t.action}<ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
