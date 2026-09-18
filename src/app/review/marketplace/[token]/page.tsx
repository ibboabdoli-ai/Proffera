import type { CSSProperties, Metadata } from "react";
import Link from "next/link";
import { BadgeCheck, ShieldCheck } from "lucide-react";

import { VerifiedReviewForm } from "@/app/review/[token]/verified-review-form";
import lifecycleStyles from "@/components/customer-lifecycle/customer-lifecycle.module.css";
import { verifiedReviewTokenSchema } from "@/features/reviews/verified-review";
import { getMarketplaceVerifiedReviewPreviewByHash } from "@/lib/marketplace-verified-review";
import { hashVerifiedReviewToken } from "@/lib/verified-review-token";

export const dynamic = "force-dynamic";

type Locale = "sv" | "en";

export async function generateMetadata({
  searchParams,
}: {
  searchParams?: Promise<{ lang?: string | string[] }>;
}): Promise<Metadata> {
  const query = await (searchParams ?? Promise.resolve(undefined));
  const raw = Array.isArray(query?.lang) ? query.lang[0] : query?.lang;
  const locale: Locale = raw === "en" ? "en" : "sv";
  return {
    title: { absolute: locale === "en" ? "Verified Marketplace review" : "Verifierat Marketplace-omdöme" },
    description: locale === "en"
      ? "Submit a secure verified review after a completed Proffera Marketplace job."
      : "Skicka ett säkert verifierat omdöme efter ett slutfört Proffera Marketplace-jobb.",
    robots: { index: false, follow: false },
  };
}

const stateCopy = {
  sv: {
    expired: ["Omdömeslänken har gått ut", "Den säkra engångslänken är inte längre aktiv."],
    used: ["Omdömet har redan skickats", "Varje slutfört Marketplace-jobb kan bara skapa ett verifierat omdöme."],
    revoked: ["Omdömeslänken är återkallad", "Länken kan inte längre användas."],
    unavailable: ["Jobbet kan inte recenseras", "Verifierade omdömen är bara tillgängliga efter ett slutfört Marketplace-jobb."],
    invalid: ["Omdömeslänken är ogiltig", "Kontrollera att hela länken kopierades korrekt."],
    eyebrow: "Verifierat Marketplace-omdöme",
    secure: "Den här säkra engångslänken är kopplad till ett verkligt slutfört Marketplace-jobb i Proffera.",
    safety: "Omdömeslänkar frågar aldrig efter betalning eller lösenord.",
  },
  en: {
    expired: ["This review link has expired", "The secure one-time link is no longer active."],
    used: ["This review was already submitted", "Each completed Marketplace job can create only one verified review."],
    revoked: ["This review link was revoked", "The link can no longer be used."],
    unavailable: ["This job cannot be reviewed", "Verified reviews are only available after a completed Marketplace job."],
    invalid: ["This review link is invalid", "Check that the full link was copied correctly."],
    eyebrow: "Verified Marketplace review",
    secure: "This secure one-time link is tied to a real completed Proffera Marketplace job.",
    safety: "Review links never ask for payment or passwords.",
  },
} as const;

type UnavailableReviewState = keyof Pick<(typeof stateCopy)["sv"], "expired" | "used" | "revoked" | "unavailable" | "invalid">;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function reviewHref(token: string, locale: Locale) {
  return locale === "en"
    ? `/review/marketplace/${encodeURIComponent(token)}?lang=en`
    : `/review/marketplace/${encodeURIComponent(token)}`;
}

export default async function MarketplaceVerifiedReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ lang?: string | string[] }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const parsed = verifiedReviewTokenSchema.safeParse(token);
  const invitation = parsed.success
    ? await getMarketplaceVerifiedReviewPreviewByHash(hashVerifiedReviewToken(parsed.data))
    : null;

  const requested = first(query?.lang);
  const invitationLanguage: Locale = invitation?.language === "en" ? "en" : "sv";
  const language: Locale = requested === "en" ? "en" : requested === "sv" ? "sv" : invitationLanguage;
  const text = stateCopy[language];
  const companyName = invitation?.companyName ?? (language === "en" ? "Service provider" : "Tjänsteföretag");
  const primaryColor = invitation?.primaryColor ?? "#0a2e63";
  const homeUrl = invitation?.homeUrl ?? "/";
  const unavailableState: UnavailableReviewState = invitation && invitation.state !== "valid"
    ? invitation.state
    : "invalid";
  const heading = language === "en" ? `How did ${companyName} do?` : `Hur upplevde du ${companyName}?`;
  const style = { "--lifecycle-primary": primaryColor } as CSSProperties;

  return (
    <main lang={language} className={lifecycleStyles.page} style={style}>
      <div className={lifecycleStyles.shell}>
        <div className={lifecycleStyles.topbar}>
          <Link href={homeUrl} className={lifecycleStyles.secondaryAction}>{companyName}</Link>
          <nav className={lifecycleStyles.languageNav} aria-label={language === "en" ? "Language" : "Språk"}>
            <Link href={reviewHref(token, "sv")} className={language === "sv" ? lifecycleStyles.languageActive : lifecycleStyles.languageLink}>SV</Link>
            <Link href={reviewHref(token, "en")} className={language === "en" ? lifecycleStyles.languageActive : lifecycleStyles.languageLink}>EN</Link>
          </nav>
        </div>

        <section className={lifecycleStyles.reviewCard}>
          <p className={lifecycleStyles.eyebrow}>
            <BadgeCheck className="mr-2 inline h-4 w-4" aria-hidden="true" />
            {text.eyebrow}
          </p>

          {invitation?.state === "valid" ? (
            <>
              <h1 className={lifecycleStyles.title}>{heading}</h1>
              <p className={lifecycleStyles.lead}>{text.secure}</p>
              <VerifiedReviewForm
                token={token}
                customerName={invitation.customerName}
                service={invitation.service}
                area={invitation.area}
                companyName={companyName}
                language={language}
                primaryColor={primaryColor}
              />
            </>
          ) : (
            <>
              <h1 className={lifecycleStyles.title}>{text[unavailableState][0]}</h1>
              <p className={lifecycleStyles.lead}>{text[unavailableState][1]}</p>
              <p className={lifecycleStyles.noticeInfo}>
                <ShieldCheck className="mr-2 inline h-4 w-4" aria-hidden="true" />
                {text.safety}
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
