import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ShieldCheck } from "lucide-react";

import { ActivationForm } from "@/app/aktivera/[token]/activation-form";
import authStyles from "@/components/auth/auth-marketplace.module.css";
import { getWorkspaceMemberInvitation } from "@/features/company/workspace-member-invitation";
import { acceptMemberInvitationAction } from "./actions";

export const metadata: Metadata = {
  title: "Join workspace | Gå med i arbetsyta",
  robots: { index: false, follow: false },
};

type Locale = "sv" | "en";

const copy = {
  sv: {
    language: "Språk",
    invalidTitle: "Länken kan inte användas",
    invalidText: "Den är ogiltig, har gått ut eller har redan använts.",
    contact: "Kontakta Proffera",
    eyebrow: "Proffera arbetsyta",
    title: (companyName: string) => `Du är inbjuden till ${companyName}`,
    secureAccess: "Egen säker åtkomst till arbetsytan.",
    singleUse: "Länken kan bara användas en gång.",
    create: "Skapa ditt konto",
    account: "Konto",
    errors: {
      password: "Lösenorden måste vara lika och innehålla minst 8 tecken.",
      expired: "Länken har gått ut. Be Owner skicka en ny inbjudan.",
      account: "Kontot kunde inte skapas. Kontakta den som bjöd in dig.",
      database: "Inbjudan kunde inte slutföras just nu.",
      invalid: "Länken är ogiltig eller redan använd.",
    },
  },
  en: {
    language: "Language",
    invalidTitle: "This link cannot be used",
    invalidText: "It is invalid, has expired, or has already been used.",
    contact: "Contact Proffera",
    eyebrow: "Proffera workspace",
    title: (companyName: string) => `You are invited to ${companyName}`,
    secureAccess: "Your own secure access to the workspace.",
    singleUse: "The link can only be used once.",
    create: "Create your account",
    account: "Account",
    errors: {
      password: "The passwords must match and contain at least 8 characters.",
      expired: "The link has expired. Ask the workspace owner to send a new invitation.",
      account: "The account could not be created. Contact the person who invited you.",
      database: "The invitation could not be completed right now.",
      invalid: "The link is invalid or has already been used.",
    },
  },
} as const;

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function inviteHref(token: string, locale: Locale) {
  return locale === "en"
    ? `/bjud-in/${encodeURIComponent(token)}?lang=en`
    : `/bjud-in/${encodeURIComponent(token)}`;
}

export default async function MemberInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ error?: string | string[]; lang?: string | string[] }>;
}) {
  const [{ token }, query] = await Promise.all([
    params,
    searchParams ?? Promise.resolve(undefined),
  ]);
  const locale: Locale = first(query?.lang) === "en" ? "en" : "sv";
  const text = copy[locale];
  const invite = await getWorkspaceMemberInvitation(token);
  const errorKey = first(query?.error);
  const errorMessage = errorKey
    ? text.errors[errorKey as keyof typeof text.errors] ?? text.errors.invalid
    : null;

  if (!invite) {
    return (
      <main className={authStyles.page} lang={locale}>
        <section className={authStyles.shell}>
          <div className={authStyles.single}>
            <div className={authStyles.languageRow} aria-label={text.language}>
              <span>{text.language}:</span>
              <Link href={inviteHref(token, "sv")} className={`${authStyles.languageLink} ${locale === "sv" ? authStyles.languageActive : ""}`}>SV</Link>
              <Link href={inviteHref(token, "en")} className={`${authStyles.languageLink} ${locale === "en" ? authStyles.languageActive : ""}`}>EN</Link>
            </div>
            <section className={authStyles.card}>
              <p className={authStyles.cardEyebrow}>{text.eyebrow}</p>
              <h1 className={authStyles.cardTitle}>{text.invalidTitle}</h1>
              <p className={authStyles.cardLead}>{text.invalidText}</p>
              <div className={authStyles.linkRow}>
                <Link href={locale === "en" ? "/en/contact" : "/kontakt"} className={authStyles.textLink}>{text.contact}</Link>
              </div>
            </section>
          </div>
        </section>
      </main>
    );
  }

  const action = acceptMemberInvitationAction.bind(null, token);

  return (
    <main className={authStyles.page} lang={locale}>
      <section className={authStyles.shell}>
        <div className={authStyles.single}>
          <div className={authStyles.languageRow} aria-label={text.language}>
            <span>{text.language}:</span>
            <Link href={inviteHref(token, "sv")} className={`${authStyles.languageLink} ${locale === "sv" ? authStyles.languageActive : ""}`}>SV</Link>
            <Link href={inviteHref(token, "en")} className={`${authStyles.languageLink} ${locale === "en" ? authStyles.languageActive : ""}`}>EN</Link>
          </div>

          <section className={authStyles.card}>
            <p className={authStyles.cardEyebrow}>{text.eyebrow}</p>
            <h1 className={authStyles.cardTitle}>{text.title(invite.companyName)}</h1>
            <p className={authStyles.cardLead}>{text.account}: <strong>{invite.email}</strong></p>

            <ul className={authStyles.trustList}>
              <li className={authStyles.trustItem}>
                <span className={authStyles.trustMark}><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /></span>
                <span>{text.secureAccess}</span>
              </li>
              <li className={authStyles.trustItem}>
                <span className={authStyles.trustMark}><ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /></span>
                <span>{text.singleUse}</span>
              </li>
            </ul>

            <h2 className="mt-6 text-lg font-black text-[#0a2e63]">{text.create}</h2>
            {errorMessage ? <p className={`${authStyles.statusError} mt-3`} role="alert">{errorMessage}</p> : null}
            <ActivationForm action={action} locale={locale} />
          </section>
        </div>
      </section>
    </main>
  );
}
