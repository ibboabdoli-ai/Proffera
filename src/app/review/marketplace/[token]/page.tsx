import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { cache } from "react";

import styles from "@/app/public-customer-lifecycle.module.css";
import { VerifiedReviewForm } from "@/app/review/[token]/verified-review-form";
import { verifiedReviewTokenSchema } from "@/features/reviews/verified-review";
import { getMarketplaceVerifiedReviewPreviewByHash } from "@/lib/marketplace-verified-review";
import { hashVerifiedReviewToken } from "@/lib/verified-review-token";

export const dynamic = "force-dynamic";

type Locale = "sv" | "en";

type MarketplaceReviewPageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ lang?: string | string[] }>;
};

const getCachedMarketplaceVerifiedReviewInvitation = cache(async (token: string) => {
  const parsed = verifiedReviewTokenSchema.safeParse(token);
  return parsed.success
    ? await getMarketplaceVerifiedReviewPreviewByHash(hashVerifiedReviewToken(parsed.data))
    : null;
});

function localeFrom(value: string | string[] | undefined, fallback: Locale): Locale {
  if (Array.isArray(value)) return value[0] === "en" ? "en" : value[0] === "sv" ? "sv" : fallback;
  if (value === "en" || value === "sv") return value;
  return fallback;
}

function reviewHref(token: string, locale: Locale) {
  const base = "/review/marketplace/" + encodeURIComponent(token);
  return base + `?lang=${locale}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: MarketplaceReviewPageProps): Promise<Metadata> {
  const [{ token }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const invitation = await getCachedMarketplaceVerifiedReviewInvitation(token);
  const invitationLanguage: Locale = invitation?.language === "en" ? "en" : "sv";
  const locale = localeFrom(query?.lang, invitationLanguage);
  return {
    title: { absolute: locale === "en" ? "Verified Marketplace review" : "Verifierat Marketplace-omdöme" },
    description: locale === "en"
      ? "Submit a secure verified review after a completed Proffera Marketplace job."
      : "Lämna ett säkert verifierat omdöme efter ett slutfört Proffera Marketplace-jobb.",
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
  },
  en: {
    expired: ["This review link has expired", "The secure one-time link is no longer active."],
    used: ["This review was already submitted", "Each completed Marketplace job can create only one verified review."],
    revoked: ["This review link was revoked", "The link can no longer be used."],
    unavailable: ["This job cannot be reviewed", "Verified reviews are only available after a completed Marketplace job."],
    invalid: ["This review link is invalid", "Check that the full link was copied correctly."],
  },
} as const;

type UnavailableReviewState = keyof (typeof stateCopy)["sv"];

export default async function MarketplaceVerifiedReviewPage({
  params,
  searchParams,
}: MarketplaceReviewPageProps) {
  const [{ token }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const invitation = await getCachedMarketplaceVerifiedReviewInvitation(token);
  const invitationLanguage: Locale = invitation?.language === "en" ? "en" : "sv";
  const language = localeFrom(query?.lang, invitationLanguage);
  const companyName = invitation?.companyName ?? (language === "en" ? "Service provider" : "Tjänsteföretag");
  const primaryColor = invitation?.primaryColor ?? "#1469d8";
  const homeUrl = invitation?.homeUrl ?? "/";
  const alternativeLanguage: Locale = language === "en" ? "sv" : "en";
  const unavailableState: UnavailableReviewState = invitation && invitation.state !== "valid"
    ? invitation.state
    : "invalid";
  const heading = language === "en" ? "How did " + companyName + " do?" : "Hur upplevde du " + companyName + "?";
  const languageLabel = language === "en" ? "Svenska" : "English";
  const badge = language === "en" ? "Verified Marketplace review" : "Verifierat Marketplace-omdöme";

  return (
    <main lang={language} className={styles.page}>
      <section className={[styles.frame, styles.reviewFrame].join(" ")}>
        <div className={styles.tenantBar} style={{ backgroundColor: primaryColor }} />
        <header className={styles.header}>
          <div className={styles.headerRow}>
            <div className={styles.headerCopy}>
              <p className={styles.eyebrow}>Proffera Marketplace</p>
              <h1 className={styles.title}>{badge}</h1>
            </div>
            <Link href={reviewHref(token, alternativeLanguage)} className={styles.languageLink}>
              {languageLabel}
            </Link>
          </div>
        </header>

        {invitation ? (
          <Link href={homeUrl} className={styles.companyIdentity}>
            <span className={styles.logoFrame}>
              <span className={styles.logoFallback} style={{ backgroundColor: primaryColor }} aria-hidden="true">
                {companyName.charAt(0).toUpperCase()}
              </span>
            </span>
            <span className={styles.companyName}>{companyName}</span>
          </Link>
        ) : null}

        <div className={styles.content}>
          {invitation?.state === "valid" ? (
            <>
              <div>
                <p className={styles.verifiedLabel}>
                  <BadgeCheck className="h-5 w-5" aria-hidden="true" />
                  {badge}
                </p>
                <h2 className={styles.reviewQuestion}>{heading}</h2>
                <p className={styles.reviewLead}>
                  {language === "en"
                    ? "This secure one-time link is tied to a real completed Proffera Marketplace job."
                    : "Den här säkra engångslänken är kopplad till ett verkligt slutfört Marketplace-jobb i Proffera."}
                </p>
              </div>
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
              <div>
                <p className={styles.verifiedLabel}>
                  <BadgeCheck className="h-5 w-5" aria-hidden="true" />
                  {badge}
                </p>
                <h2 className={styles.reviewQuestion}>{stateCopy[language][unavailableState][0]}</h2>
                <p className={styles.reviewLead}>{stateCopy[language][unavailableState][1]}</p>
              </div>
              <div className={styles.reviewSecurity}>
                <p>
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  {language === "en"
                    ? "Review links never ask for payment or passwords."
                    : "Omdömeslänkar frågar aldrig efter betalning eller lösenord."}
                </p>
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
