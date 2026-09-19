import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Clock3, ShieldCheck } from "lucide-react";
import { cache } from "react";

import { getVerifiedReviewInvitation } from "@/lib/verified-review-invitations";
import styles from "@/app/public-customer-lifecycle.module.css";
import { VerifiedReviewForm } from "./verified-review-form";

export const dynamic = "force-dynamic";

type Locale = "sv" | "en";

type ReviewPageProps = {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ lang?: string | string[] }>;
};

const getCachedVerifiedReviewInvitation = cache(getVerifiedReviewInvitation);

function localeFrom(value: string | string[] | undefined, fallback: Locale): Locale {
  if (Array.isArray(value)) return value[0] === "en" ? "en" : value[0] === "sv" ? "sv" : fallback;
  if (value === "en" || value === "sv") return value;
  return fallback;
}

function reviewHref(token: string, locale: Locale) {
  const base = "/review/" + encodeURIComponent(token);
  return locale === "en" ? base + "?lang=en" : base;
}

const englishMetadata: Metadata = {
  title: { absolute: "Verified customer review" },
  description: "Submit a secure, single-use review for a completed customer booking.",
  robots: { index: false, follow: false },
};

export async function generateMetadata({
  params,
  searchParams,
}: ReviewPageProps): Promise<Metadata> {
  const [{ token }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const invitation = await getCachedVerifiedReviewInvitation(token);
  const invitationLanguage: Locale = invitation.language === "en" ? "en" : "sv";
  const locale = localeFrom(query?.lang, invitationLanguage);
  if (locale === "en") return englishMetadata;
  return {
    title: { absolute: "Verifierat kundomdöme" },
    description: "Lämna ett säkert verifierat omdöme efter en slutförd bokning.",
    robots: { index: false, follow: false },
  };
}

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

export default async function VerifiedReviewPage({ params, searchParams }: ReviewPageProps) {
  const [{ token }, query] = await Promise.all([params, searchParams ?? Promise.resolve(undefined)]);
  const invitation = await getCachedVerifiedReviewInvitation(token);
  const invitationLanguage: Locale = invitation.language === "en" ? "en" : "sv";
  const language = localeFrom(query?.lang, invitationLanguage);
  const companyName = invitation.companyName ?? (language === "en" ? "Service provider" : "Tjänsteföretag");
  const primaryColor = invitation.primaryColor ?? "#1469d8";
  const homeUrl = invitation.homeUrl ?? "/";
  const alternativeLanguage: Locale = language === "en" ? "sv" : "en";
  const text = language === "en"
    ? {
        badge: "Verified customer review",
        question: "How did " + companyName + " do?",
        secure: "This secure link is connected to your completed booking. It can be used once and expires on",
        payment: "Review invitations never ask for payment or account passwords.",
        help: "Need help? Contact " + companyName + " through its official website.",
        visit: "Visit " + companyName,
        language: "Svenska",
      }
    : {
        badge: "Verifierat kundomdöme",
        question: "Hur upplevde du " + companyName + "?",
        secure: "Den säkra länken är kopplad till din slutförda bokning. Den kan användas en gång och gäller till",
        payment: "Omdömesinbjudningar frågar aldrig efter betalning eller kontolösenord.",
        help: "Behöver du hjälp? Kontakta " + companyName + " via företagets officiella webbplats.",
        visit: "Besök " + companyName,
        language: "English",
      };

  return (
    <main className={styles.page} lang={language}>
      <section className={[styles.frame, styles.reviewFrame].join(" ")}>
        <div className={styles.tenantBar} style={{ backgroundColor: primaryColor }} />
        <header className={styles.header}>
          <div className={styles.headerRow}>
            <div className={styles.headerCopy}>
              <p className={styles.eyebrow}>Proffera</p>
              <h1 className={styles.title}>{text.badge}</h1>
            </div>
            <Link href={reviewHref(token, alternativeLanguage)} className={styles.languageLink}>
              {text.language}
            </Link>
          </div>
        </header>

        <Link href={homeUrl} aria-label={companyName} className={styles.companyIdentity}>
          <span className={styles.logoFrame}>
            {invitation.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={invitation.logoUrl} alt="" className={styles.logoImage} />
            ) : (
              <span className={styles.logoFallback} style={{ backgroundColor: primaryColor }} aria-hidden="true">
                {companyName.charAt(0).toUpperCase()}
              </span>
            )}
          </span>
          <span className={styles.companyName}>{companyName}</span>
        </Link>

        <div className={styles.content}>
          {invitation.state === "valid" ? (
            <>
              <div>
                <p className={styles.verifiedLabel}>
                  <BadgeCheck className="h-5 w-5" aria-hidden="true" />
                  {text.badge}
                </p>
                <h2 className={styles.reviewQuestion}>{text.question}</h2>
                <p className={styles.reviewLead}>
                  {text.secure}{" "}
                  {new Intl.DateTimeFormat(language === "en" ? "en-GB" : "sv-SE", {
                    dateStyle: "medium",
                    timeZone: invitation.timeZone,
                  }).format(new Date(invitation.expiresAt))}.
                </p>
              </div>
              <VerifiedReviewForm
                token={token}
                customerName={invitation.customerName}
                service={invitation.service}
                area={invitation.area}
                companyName={invitation.companyName}
                language={language}
                primaryColor={primaryColor}
              />
            </>
          ) : (
            <>
              <div>
                <p className={styles.verifiedLabel}>
                  <BadgeCheck className="h-5 w-5" aria-hidden="true" />
                  {text.badge}
                </p>
                <h2 className={styles.reviewQuestion}>{stateContent[language][invitation.state][0]}</h2>
                <p className={styles.reviewLead}>{stateContent[language][invitation.state][1]}</p>
              </div>
              <div className={styles.reviewSecurity}>
                <p>
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  {text.payment}
                </p>
                <p>
                  <Clock3 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  {text.help}
                </p>
              </div>
              <Link href={homeUrl} className={styles.secondaryButton}>{text.visit}</Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
