import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ShieldCheck } from "lucide-react";

import { verifiedReviewTokenSchema } from "@/features/reviews/verified-review";
import { getMarketplaceVerifiedReviewPreviewByHash } from "@/lib/marketplace-verified-review";
import { hashVerifiedReviewToken } from "@/lib/verified-review-token";
import { VerifiedReviewForm } from "@/app/review/[token]/verified-review-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { absolute: "Verified Marketplace review" },
  description: "Submit a secure verified review after a completed Proffera Marketplace job.",
  robots: { index: false, follow: false },
};

const stateCopy = {
  sv: {
    expired: ["Omdömeslänken har gått ut", "Den säkra engångslänken är inte längre aktiv."],
    used: ["Omdömet har redan skickats", "Varje slutfört Marketplace-jobb kan bara skapa ett verifierat omdöme."],
    revoked: ["Omdömeslänken är återkallad", "Länken kan inte längre användas."],
    unavailable: ["Jobbet kan inte recenseras", "Verifierade omdömen är bara tillgängliga efter ett slutfört Marketplace-jobb."],
    invalid: ["Omdömeslänken är ogiltig", "Kontrollera att hela länken kopierades korrekt."],
  },
  en: {
    expired: ["This review link has expired", "The secure one-time link is no longer active."],
    used: ["This review was already submitted", "Each completed Marketplace job can create only one verified review."],
    revoked: ["This review link was revoked", "The link can no longer be used."],
    unavailable: ["This job cannot be reviewed", "Verified reviews are only available after a completed Marketplace job."],
    invalid: ["This review link is invalid", "Check that the full link was copied correctly."],
  },
} as const;

export default async function MarketplaceVerifiedReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const parsed = verifiedReviewTokenSchema.safeParse(token);
  const invitation = parsed.success
    ? await getMarketplaceVerifiedReviewPreviewByHash(hashVerifiedReviewToken(parsed.data))
    : null;
  const language = invitation?.language === "en" ? "en" : "sv";
  const companyName = invitation?.companyName ?? "Service provider";
  const primaryColor = invitation?.primaryColor ?? "#173e2b";
  const accentColor = invitation?.accentColor ?? "#d8ae52";
  const homeUrl = invitation?.homeUrl ?? "/";
  const state = invitation?.state ?? "invalid";
  const heading = language === "en" ? `How did ${companyName} do?` : `Hur upplevde du ${companyName}?`;

  return (
    <main
      lang={language}
      className="min-h-screen px-4 py-10 text-slate-900 sm:px-6 sm:py-16"
      style={{ backgroundColor: `${accentColor}18` }}
    >
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex justify-center">
          <Link href={homeUrl} className="rounded-2xl bg-white px-5 py-3 font-black shadow-lg">{companyName}</Link>
        </div>
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,.14)] sm:p-9">
          <p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.15em]" style={{ color: primaryColor }}>
            <BadgeCheck className="size-5" aria-hidden="true" />
            {language === "en" ? "Verified Marketplace review" : "Verifierat Marketplace-omdöme"}
          </p>

          {invitation?.state === "valid" ? (
            <>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{heading}</h1>
              <p className="mt-3 text-base leading-7 text-slate-600">
                {language === "en"
                  ? "This secure one-time link is tied to a real completed Proffera Marketplace job."
                  : "Den här säkra engångslänken är kopplad till ett verkligt slutfört Marketplace-jobb i Proffera."}
              </p>
              <div className="mt-7">
                <VerifiedReviewForm
                  token={token}
                  customerName={invitation.customerName}
                  service={invitation.service}
                  area={invitation.area}
                  companyName={companyName}
                  language={language}
                  primaryColor={primaryColor}
                />
              </div>
            </>
          ) : (
            <>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{stateCopy[language][state][0]}</h1>
              <p className="mt-4 text-base leading-7 text-slate-600">{stateCopy[language][state][1]}</p>
              <p className="mt-7 flex items-start gap-2 rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-700">
                <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                {language === "en" ? "Review links never ask for payment or passwords." : "Omdömeslänkar frågar aldrig efter betalning eller lösenord."}
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
