import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Clock3, ShieldCheck } from "lucide-react";

import { getVerifiedReviewInvitation } from "@/lib/verified-review-invitations";
import { VerifiedReviewForm } from "./verified-review-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verified customer review | Proffera",
  robots: { index: false, follow: false },
};

type ReviewPageProps = {
  params: Promise<{ token: string }>;
};

const stateContent = {
  sv: {
    invalid: ["Omdömeslänken är ogiltig", "Kontrollera att hela länken kopierades korrekt eller be företaget om en ny inbjudan."],
    expired: ["Omdömeslänken har gått ut", "Kontakta företaget om du fortfarande vill lämna ett verifierat omdöme."],
    used: ["Omdömet har redan skickats", "Varje slutförd bokning kan bara skapa ett verifierat kundomdöme."],
    revoked: ["Omdömeslänken är inte längre aktiv", "Kontakta företaget om du behöver en ny inbjudan."],
    unavailable: ["Bokningen kan inte recenseras", "Verifierade omdömeslänkar är bara tillgängliga efter en slutförd tjänst."],
  },
  en: {
    invalid: ["This review link is invalid", "Check that the full link was copied correctly, or ask the company for a new invitation."],
    expired: ["This review link has expired", "Contact the company if you still want to leave a verified customer review."],
    used: ["This review has already been submitted", "Each completed booking can create one verified customer review."],
    revoked: ["This review link is no longer active", "Contact the company if you need a new invitation."],
    unavailable: ["This booking is not available for review", "Verified review links are only available after a completed service."],
  },
} as const;

export default async function VerifiedReviewPage({ params }: ReviewPageProps) {
  const { token } = await params;
  const invitation = await getVerifiedReviewInvitation(token);
  const language = invitation.language ?? "en";
  const companyName = invitation.companyName ?? "Service provider";
  const primaryColor = invitation.primaryColor ?? "#173e2b";
  const accentColor = invitation.accentColor ?? "#d8ae52";
  const homeUrl = invitation.homeUrl ?? "/";
  const text = language === "en"
    ? {
        badge: "Verified customer review",
        question: `How did ${companyName} do?`,
        secure: "This secure link is connected to your completed booking. It can be used once and expires on",
        payment: "Review invitations never ask for payment or account passwords.",
        help: `Need help? Contact ${companyName} through its official website.`,
        visit: `Visit ${companyName}`,
      }
    : {
        badge: "Verifierat kundomdöme",
        question: `Hur upplevde du ${companyName}?`,
        secure: "Den säkra länken är kopplad till din slutförda bokning. Den kan användas en gång och gäller till",
        payment: "Omdömesinbjudningar frågar aldrig efter betalning eller kontolösenord.",
        help: `Behöver du hjälp? Kontakta ${companyName} via företagets officiella webbplats.`,
        visit: `Besök ${companyName}`,
      };

  return (
    <main
      className="min-h-screen px-4 py-10 text-slate-900 sm:px-6 sm:py-16"
      style={{ backgroundColor: `${accentColor}18` }}
      lang={language}
    >
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-center">
          <Link href={homeUrl} aria-label={companyName} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-lg">
            {invitation.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={invitation.logoUrl} alt="" className="size-12 rounded-xl object-cover" />
            ) : (
              <span
                className="grid size-12 place-items-center rounded-xl text-xl font-black text-white"
                style={{ backgroundColor: primaryColor }}
                aria-hidden="true"
              >
                {companyName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="font-black">{companyName}</span>
          </Link>
        </div>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,.14)] sm:p-9">
          <div className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.15em]" style={{ color: primaryColor }}>
            <BadgeCheck className="size-5" aria-hidden="true" />
            {text.badge}
          </div>

          {invitation.state === "valid" ? (
            <>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                {text.question}
              </h1>
              <p className="mt-3 text-base leading-7 text-slate-600">
                {text.secure}{" "}
                {new Intl.DateTimeFormat(language === "en" ? "en-GB" : "sv-SE", {
                  dateStyle: "medium",
                  timeZone: invitation.timeZone,
                }).format(new Date(invitation.expiresAt))}.
              </p>
              <div className="mt-7">
                <VerifiedReviewForm
                  token={token}
                  customerName={invitation.customerName}
                  service={invitation.service}
                  area={invitation.area}
                  companyName={invitation.companyName}
                  language={invitation.language}
                  primaryColor={invitation.primaryColor}
                />
              </div>
            </>
          ) : (
            <>
              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                {stateContent[language][invitation.state][0]}
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-600">
                {stateContent[language][invitation.state][1]}
              </p>
              <div className="mt-7 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-700">
                <p className="flex items-center gap-2 font-bold">
                  <ShieldCheck className="size-5" aria-hidden="true" />
                  {text.payment}
                </p>
                <p className="flex items-center gap-2">
                  <Clock3 className="size-5" aria-hidden="true" />
                  {text.help}
                </p>
              </div>
              <Link
                href={homeUrl}
                className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl px-5 py-3 text-sm font-black text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {text.visit}
              </Link>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
