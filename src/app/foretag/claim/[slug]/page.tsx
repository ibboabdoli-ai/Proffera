import type { Metadata } from "next";
import { ArrowLeft, BadgeCheck, Building2, Fingerprint, KeyRound, Mail, RefreshCw, ShieldCheck, UserCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { getServerSession } from "@/lib/auth-session";
import { parseClaimEmailEvidence } from "@/lib/company-directory-claim-email";
import { getPublicDirectoryBusiness } from "@/lib/company-directory-engine";
import { getSql } from "@/lib/db/server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

type Locale = "sv" | "en";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ status?: string | string[]; lang?: string | string[] }>;
};

const statusMessages: Record<Locale, Record<string, { title: string; body: string }>> = {
  sv: {
    sent: { title: "Företagsmejlen är verifierad", body: "Anspråket väntar nu på manuell granskning. Vi kopplar inte profilen till ditt konto och skapar ingen workspace förrän Proffera har godkänt din behörighet till företaget." },
    email_code_sent: { title: "Verifieringskod skickad", body: "Kontrollera företagsmejlen och ange den sexsiffriga koden nedan. Koden gäller i 10 minuter." },
    email_code_invalid: { title: "Fel verifieringskod", body: "Koden stämmer inte. Kontrollera mejlet och försök igen. Efter fem felaktiga försök måste en ny kod skickas." },
    email_code_expired: { title: "Koden har gått ut", body: "Skicka en ny kod till samma företagsmejl för att fortsätta." },
    email_code_locked: { title: "För många felaktiga koder", body: "Den här koden är låst. Skicka en ny kod för att fortsätta verifieringen." },
    email_delivery_failed: { title: "Kunde inte skicka verifieringsmejlet", body: "Inget anspråk har skickats till granskning. Kontrollera e-postadressen och försök igen senare." },
    email_send_rate_limited: { title: "Vänta innan du skickar en ny kod", body: "För många verifieringsmejl har begärts på kort tid. Försök igen om en stund." },
    email_verification_required: { title: "Verifiera företagsmejlen först", body: "Manuella anspråk kan inte skickas direkt. Börja med den kostnadsfria e-postverifieringen nedan." },
    reset: { title: "Verifieringen har återställts", body: "Du kan nu ange nya uppgifter och skicka en ny verifieringskod." },
    rate_limited: { title: "För många försök", body: "Försök igen senare. Begränsningen skyddar företag mot automatiska eller felaktiga anspråk." },
    unavailable: { title: "Tjänsten är tillfälligt otillgänglig", body: "Ingen åtkomst till företagsprofilen har getts. Försök igen senare." },
    claimed: { title: "Profilen är redan kopplad", body: "Företagsprofilen har redan en verifierad koppling till en Proffera-workspace." },
    invalid_details: { title: "Kontrollera uppgifterna", body: "Namn, roll och företagsmejl måste vara korrekt ifyllda innan verifieringen kan fortsätta." },
    account_email_unverified: { title: "Verifiera ditt Proffera-konto först", body: "E-postadressen på kontot som skickar anspråket måste vara verifierad. Anspråket knyts alltid till det inloggade kontot." },
    bankid_unavailable: { title: "BankID är inte aktiverat ännu", body: "BankID är en valfri snabb verifieringsmetod och aktiveras senare. Du kan använda kostnadsfri e-post + manuell verifiering redan nu." },
  },
  en: {
    sent: { title: "Business email verified", body: "The claim is now waiting for manual review. We do not connect the profile to your account or create a workspace until Proffera has verified your authority to represent the business." },
    email_code_sent: { title: "Verification code sent", body: "Check the business email and enter the six-digit code below. The code is valid for 10 minutes." },
    email_code_invalid: { title: "Incorrect verification code", body: "The code does not match. Check the email and try again. After five incorrect attempts, a new code must be sent." },
    email_code_expired: { title: "The code has expired", body: "Send a new code to the same business email to continue." },
    email_code_locked: { title: "Too many incorrect codes", body: "This code is locked. Send a new code to continue verification." },
    email_delivery_failed: { title: "Could not send the verification email", body: "No claim was submitted for review. Check the email address and try again later." },
    email_send_rate_limited: { title: "Wait before sending a new code", body: "Too many verification emails were requested in a short period. Try again in a while." },
    email_verification_required: { title: "Verify the business email first", body: "Manual claims cannot be submitted directly. Start with the free email verification below." },
    reset: { title: "Verification reset", body: "You can now enter new details and send a new verification code." },
    rate_limited: { title: "Too many attempts", body: "Try again later. This limit protects businesses from automated or incorrect claims." },
    unavailable: { title: "Service temporarily unavailable", body: "No access to the business profile has been granted. Try again later." },
    claimed: { title: "Profile already connected", body: "This business profile already has a verified connection to a Proffera workspace." },
    invalid_details: { title: "Check the details", body: "Name, role, and business email must be correctly completed before verification can continue." },
    account_email_unverified: { title: "Verify your Proffera account first", body: "The email address on the account submitting the claim must be verified. The claim is always tied to the signed-in account." },
    bankid_unavailable: { title: "BankID is not enabled yet", body: "BankID is an optional faster verification method and will be enabled later. You can use free email + manual verification now." },
  },
};

const copy = {
  sv: {
    back: "Tillbaka till profilen",
    eyebrow: "Gör anspråk på företaget",
    intro: "Anspråket tillhör alltid det Proffera-konto som är inloggat. Ingen får kontroll över profilen förrän företagsmejlen och rätten att företräda företaget har verifierats.",
    officialTitle: "Företaget matchas mot officiella uppgifter",
    officialBody: "Namn, status och bransch ändras inte av ett anspråk.",
    workspaceTitle: "Ingen workspace skapas utan verifiering",
    workspaceBody: "Verifierat mejl räcker inte ensamt. Proffera gör också en manuell kontroll av behörigheten.",
    bankIdTitle: "Verifiera med BankID",
    optionalSoon: "VALFRITT · KOMMER SNART",
    bankIdBody: "Snabbare identitetskontroll. BankID är inte ett krav och inga BankID-anrop eller kostnader aktiveras i Proffera nu.",
    bankIdButton: "BankID aktiveras senare",
    verifyEmailTitle: "Verifiera företagsmejlen",
    codeSentPrefix: "En sexsiffrig kod skickades till",
    businessEmailFallback: "företagsmejlen",
    publicMailboxWarning: "Det här är en extern e-postleverantör. Proffera kommer därför att kräva extra manuell kontroll innan anspråket kan godkännas.",
    codeLabel: "Verifieringskod",
    verifyCodeButton: "Verifiera mejl och skicka till granskning",
    resend: "Skicka ny kod",
    changeDetails: "Ändra uppgifter",
    emailManualTitle: "E-post + manuell verifiering",
    free: "KOSTNADSFRI",
    emailManualBody: "Först verifierar vi att du har tillgång till företagsmejlen. Därefter granskar Proffera manuellt att du får företräda företaget.",
    name: "Ditt namn",
    role: "Din roll i företaget",
    rolePlaceholder: "Ex. ägare, VD, firmatecknare",
    businessEmail: "Företagsmejl",
    phone: "Telefonnummer",
    optional: "(valfritt)",
    authority: "Jag bekräftar att jag själv använder detta Proffera-konto och att uppgifterna ovan är korrekta. Jag förstår att verifiering av mejlet inte ger åtkomst innan Proffera även har verifierat min behörighet till företaget.",
    sendCode: "Skicka kod till företagsmejlen",
    signedInAs: "Inloggad som",
    userFallback: "Proffera-användare",
    login: "Logga in för att fortsätta",
  },
  en: {
    back: "Back to profile",
    eyebrow: "Claim this business",
    intro: "The claim always belongs to the Proffera account that is signed in. No one gets control of the profile until the business email and the right to represent the business have been verified.",
    officialTitle: "The business is matched against official data",
    officialBody: "Name, status, and industry are not changed by a claim.",
    workspaceTitle: "No workspace is created without verification",
    workspaceBody: "A verified email is not enough on its own. Proffera also manually checks your authority.",
    bankIdTitle: "Verify with BankID",
    optionalSoon: "OPTIONAL · COMING SOON",
    bankIdBody: "Faster identity verification. BankID is not required and no BankID calls or costs are activated in Proffera now.",
    bankIdButton: "BankID will be enabled later",
    verifyEmailTitle: "Verify the business email",
    codeSentPrefix: "A six-digit code was sent to",
    businessEmailFallback: "the business email",
    publicMailboxWarning: "This is an external email provider. Proffera will therefore require additional manual review before the claim can be approved.",
    codeLabel: "Verification code",
    verifyCodeButton: "Verify email and submit for review",
    resend: "Send new code",
    changeDetails: "Change details",
    emailManualTitle: "Email + manual verification",
    free: "FREE",
    emailManualBody: "First we verify that you have access to the business email. Proffera then manually reviews whether you are authorized to represent the business.",
    name: "Your name",
    role: "Your role in the business",
    rolePlaceholder: "E.g. owner, CEO, authorized signatory",
    businessEmail: "Business email",
    phone: "Phone number",
    optional: "(optional)",
    authority: "I confirm that I personally use this Proffera account and that the details above are correct. I understand that verifying the email does not grant access until Proffera has also verified my authority to represent the business.",
    sendCode: "Send code to business email",
    signedInAs: "Signed in as",
    userFallback: "Proffera user",
    login: "Sign in to continue",
  },
} as const;

function localeFrom(value: string | string[] | undefined): Locale {
  return Array.isArray(value) ? (value[0] === "en" ? "en" : "sv") : value === "en" ? "en" : "sv";
}

function withLocale(path: string, locale: Locale) {
  return locale === "en" ? `${path}${path.includes("?") ? "&" : "?"}lang=en` : path;
}

export default async function ClaimCompanyPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const [business, session, query] = await Promise.all([
    getPublicDirectoryBusiness(slug),
    getServerSession(),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  if (!business) notFound();

  const locale = localeFrom(query?.lang);
  const text = copy[locale];
  const status = Array.isArray(query?.status) ? query?.status[0] : query?.status;
  const message = status ? statusMessages[locale][status] : null;
  const profileHref = withLocale(`/foretag/listad/${encodeURIComponent(business.slug)}`, locale);
  const returnTo = withLocale(`/foretag/claim/${encodeURIComponent(business.slug)}`, locale);

  let emailEvidence: ReturnType<typeof parseClaimEmailEvidence> = null;
  if (session?.user?.id) {
    const sql = getSql();
    if (sql) {
      const rows = await sql`
        select claim.verification_reference
        from company_directory_claims claim
        join company_directory_profiles profile on profile.id = claim.profile_id
        where profile.public_slug = ${business.slug}
          and claim.claimant_user_id = ${String(session.user.id)}
          and claim.status = 'pending'
          and claim.verification_method = 'email_domain'
        order by claim.requested_at desc
        limit 1
      `;
      emailEvidence = parseClaimEmailEvidence(rows[0]?.verification_reference);
    }
  }

  const challengeActive = emailEvidence?.stage === "business_email_code_sent" || emailEvidence?.stage === "business_email_locked";
  const challengeLocked = emailEvidence?.stage === "business_email_locked";
  const challengeExpired = status === "email_code_expired";

  return (
    <main lang={locale} className="min-h-screen bg-[#f6f7f5] px-4 py-10 text-[#17201a] sm:px-6">
      <div className="mx-auto max-w-2xl">
        <a href={profileHref} className="inline-flex items-center text-sm font-black text-[#173e2b]">
          <ArrowLeft className="mr-2 h-4 w-4" /> {text.back}
        </a>

        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/10 sm:p-9">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f2ec] text-[#173e2b]">
            <Building2 className="h-6 w-6" />
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-[#54705e]">{text.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-black">{business.companyName}</h1>
          <p className="mt-3 text-sm leading-6 text-[#5d685f]">{text.intro}</p>

          {message ? (
            <div className="mt-7 rounded-2xl border border-[#cfe1d4] bg-[#f1f8f3] p-5">
              <p className="font-black text-[#173e2b]">{message.title}</p>
              <p className="mt-1 text-sm leading-6 text-[#536057]">{message.body}</p>
            </div>
          ) : null}

          <div className="mt-7 grid gap-3">
            <div className="flex gap-3 rounded-2xl bg-[#f7f8f6] p-4">
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#173e2b]" />
              <div><p className="font-bold">{text.officialTitle}</p><p className="mt-1 text-sm text-[#687169]">{text.officialBody}</p></div>
            </div>
            <div className="flex gap-3 rounded-2xl bg-[#f7f8f6] p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#173e2b]" />
              <div><p className="font-bold">{text.workspaceTitle}</p><p className="mt-1 text-sm text-[#687169]">{text.workspaceBody}</p></div>
            </div>
          </div>

          {status !== "sent" ? session?.user?.id ? (
            <div className="mt-8 space-y-4">
              <div className="rounded-2xl border border-[#dfe5df] bg-[#fafbfa] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <Fingerprint className="mt-0.5 h-6 w-6 shrink-0 text-[#173e2b]" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black">{text.bankIdTitle}</p>
                        <span className="rounded-full bg-[#edf0ed] px-2.5 py-1 text-[11px] font-black text-[#617067]">{text.optionalSoon}</span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-[#687169]">{text.bankIdBody}</p>
                    </div>
                  </div>
                </div>
                <button type="button" disabled className="mt-4 min-h-11 w-full cursor-not-allowed rounded-xl border border-[#d7ddd8] bg-white px-4 text-sm font-black text-[#8a938d]">{text.bankIdButton}</button>
              </div>

              {challengeActive ? (
                <div className="rounded-2xl border border-[#cfe1d4] bg-[#f3f8f4] p-5">
                  <div className="flex items-start gap-3">
                    <KeyRound className="mt-0.5 h-6 w-6 shrink-0 text-[#173e2b]" />
                    <div>
                      <p className="font-black">{text.verifyEmailTitle}</p>
                      <p className="mt-1 text-sm leading-6 text-[#5f6c63]">{text.codeSentPrefix} <strong>{emailEvidence?.businessEmail ?? text.businessEmailFallback}</strong>.</p>
                      {emailEvidence?.emailDomainKind === "public_mailbox" ? (
                        <p className="mt-2 rounded-lg bg-[#fff5da] px-3 py-2 text-xs leading-5 text-[#76580d]">{text.publicMailboxWarning}</p>
                      ) : null}
                    </div>
                  </div>

                  <form action="/api/public-directory/claim-email/verify" method="post" className="mt-5">
                    <input type="hidden" name="slug" value={business.slug} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <label className="text-sm font-bold text-[#334139]">
                      {text.codeLabel}
                      <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required disabled={challengeLocked || challengeExpired} placeholder="000000" className="mt-2 min-h-12 w-full rounded-xl border border-[#cad8ce] bg-white px-4 text-center text-xl font-black tracking-[0.35em] outline-none focus:ring-2 focus:ring-[#17452f]/20 disabled:bg-[#eef0ed] disabled:text-[#89908b]" />
                    </label>
                    <button type="submit" disabled={challengeLocked || challengeExpired} className="mt-4 min-h-12 w-full rounded-xl bg-[#173e2b] px-5 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{text.verifyCodeButton}</button>
                  </form>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <form action="/api/public-directory/claim-email/send" method="post">
                      <input type="hidden" name="slug" value={business.slug} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <input type="hidden" name="action" value="resend" />
                      <button type="submit" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#cbd8ce] bg-white px-4 text-sm font-black text-[#17452f]"><RefreshCw className="h-4 w-4" /> {text.resend}</button>
                    </form>
                    <form action="/api/public-directory/claim-email/send" method="post">
                      <input type="hidden" name="slug" value={business.slug} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <input type="hidden" name="action" value="reset" />
                      <button type="submit" className="min-h-11 w-full rounded-xl border border-[#d7ddd8] bg-white px-4 text-sm font-bold text-[#687169]">{text.changeDetails}</button>
                    </form>
                  </div>
                </div>
              ) : (
                <form action="/api/public-directory/claim-email/send" method="post" className="rounded-2xl border border-[#cfe1d4] bg-[#f3f8f4] p-5">
                  <input type="hidden" name="slug" value={business.slug} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <input type="hidden" name="action" value="start" />

                  <div className="flex items-start gap-3">
                    <UserCheck className="mt-0.5 h-6 w-6 shrink-0 text-[#173e2b]" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-black">{text.emailManualTitle}</p>
                        <span className="rounded-full bg-[#e4f2e8] px-2.5 py-1 text-[11px] font-black text-[#17452f]">{text.free}</span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-[#5f6c63]">{text.emailManualBody}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-bold text-[#334139]">{text.name}<input name="claimantName" required minLength={2} maxLength={100} defaultValue={session.user.name ?? ""} autoComplete="name" className="mt-2 min-h-11 w-full rounded-xl border border-[#cad8ce] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#17452f]/20" /></label>
                    <label className="text-sm font-bold text-[#334139]">{text.role}<input name="role" required minLength={2} maxLength={80} placeholder={text.rolePlaceholder} className="mt-2 min-h-11 w-full rounded-xl border border-[#cad8ce] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#17452f]/20" /></label>
                    <label className="text-sm font-bold text-[#334139]">{text.businessEmail}<input name="businessEmail" type="email" required maxLength={254} autoComplete="email" placeholder="name@company.se" className="mt-2 min-h-11 w-full rounded-xl border border-[#cad8ce] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#17452f]/20" /></label>
                    <label className="text-sm font-bold text-[#334139]">{text.phone} <span className="font-normal text-[#778078]">{text.optional}</span><input name="phone" type="tel" maxLength={40} autoComplete="tel" className="mt-2 min-h-11 w-full rounded-xl border border-[#cad8ce] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#17452f]/20" /></label>
                  </div>

                  <label className="mt-5 flex items-start gap-3 rounded-xl bg-white p-4 text-sm leading-6 text-[#4f5c53] ring-1 ring-black/5">
                    <input type="checkbox" name="confirmAuthority" value="yes" required className="mt-1 h-4 w-4 accent-[#17452f]" />
                    <span>{text.authority}</span>
                  </label>

                  <button type="submit" className="mt-5 min-h-12 w-full rounded-xl bg-[#173e2b] px-5 font-black text-white">{text.sendCode}</button>
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs leading-5 text-[#707870]"><Mail className="h-3.5 w-3.5" /> {text.signedInAs} {session.user.email ?? text.userFallback}</p>
                </form>
              )}
            </div>
          ) : (
            <a href={`/logga-in?next=${encodeURIComponent(returnTo)}`} className="mt-8 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#173e2b] px-5 font-black text-white">{text.login}</a>
          ) : null}
        </section>
      </div>
    </main>
  );
}
