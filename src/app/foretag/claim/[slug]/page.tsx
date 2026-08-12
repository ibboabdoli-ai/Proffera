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

type Props = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ status?: string | string[] }>;
};

const statusMessages: Record<string, { title: string; body: string }> = {
  sent: {
    title: "Företagsmejlen är verifierad",
    body: "Anspråket väntar nu på manuell granskning. Vi kopplar inte profilen till ditt konto och skapar ingen workspace förrän Proffera har godkänt din behörighet till företaget.",
  },
  email_code_sent: {
    title: "Verifieringskod skickad",
    body: "Kontrollera företagsmejlen och ange den sexsiffriga koden nedan. Koden gäller i 10 minuter.",
  },
  email_code_invalid: {
    title: "Fel verifieringskod",
    body: "Koden stämmer inte. Kontrollera mejlet och försök igen. Efter fem felaktiga försök måste en ny kod skickas.",
  },
  email_code_expired: {
    title: "Koden har gått ut",
    body: "Skicka en ny kod till samma företagsmejl för att fortsätta.",
  },
  email_code_locked: {
    title: "För många felaktiga koder",
    body: "Den här koden är låst. Skicka en ny kod för att fortsätta verifieringen.",
  },
  email_delivery_failed: {
    title: "Kunde inte skicka verifieringsmejlet",
    body: "Inget anspråk har skickats till granskning. Kontrollera e-postadressen och försök igen senare.",
  },
  email_send_rate_limited: {
    title: "Vänta innan du skickar en ny kod",
    body: "För många verifieringsmejl har begärts på kort tid. Försök igen om en stund.",
  },
  email_verification_required: {
    title: "Verifiera företagsmejlen först",
    body: "Manuella anspråk kan inte skickas direkt. Börja med den kostnadsfria e-postverifieringen nedan.",
  },
  reset: {
    title: "Verifieringen har återställts",
    body: "Du kan nu ange nya uppgifter och skicka en ny verifieringskod.",
  },
  rate_limited: {
    title: "För många försök",
    body: "Försök igen senare. Begränsningen skyddar företag mot automatiska eller felaktiga anspråk.",
  },
  unavailable: {
    title: "Tjänsten är tillfälligt otillgänglig",
    body: "Ingen åtkomst till företagsprofilen har getts. Försök igen senare.",
  },
  claimed: {
    title: "Profilen är redan kopplad",
    body: "Företagsprofilen har redan en verifierad koppling till en Proffera-workspace.",
  },
  invalid_details: {
    title: "Kontrollera uppgifterna",
    body: "Namn, roll och företagsmejl måste vara korrekt ifyllda innan verifieringen kan fortsätta.",
  },
  account_email_unverified: {
    title: "Verifiera ditt Proffera-konto först",
    body: "E-postadressen på kontot som skickar anspråket måste vara verifierad. Anspråket knyts alltid till det inloggade kontot.",
  },
  bankid_unavailable: {
    title: "BankID är inte aktiverat ännu",
    body: "BankID är en valfri snabb verifieringsmetod och aktiveras senare. Du kan använda kostnadsfri e-post + manuell verifiering redan nu.",
  },
};

export default async function ClaimCompanyPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const [business, session, query] = await Promise.all([
    getPublicDirectoryBusiness(slug),
    getServerSession(),
    searchParams ? searchParams : Promise.resolve(undefined),
  ]);
  if (!business) notFound();

  const status = Array.isArray(query?.status) ? query?.status[0] : query?.status;
  const message = status ? statusMessages[status] : null;
  const profileHref = `/foretag/listad/${encodeURIComponent(business.slug)}`;
  const returnTo = `/foretag/claim/${business.slug}`;

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
  const challengeExpired = emailEvidence?.codeExpiresAt
    ? new Date(emailEvidence.codeExpiresAt).getTime() < Date.now()
    : false;

  return (
    <main className="min-h-screen bg-[#f6f7f5] px-4 py-10 text-[#17201a] sm:px-6">
      <div className="mx-auto max-w-2xl">
        <a href={profileHref} className="inline-flex items-center text-sm font-black text-[#173e2b]">
          <ArrowLeft className="mr-2 h-4 w-4" /> Tillbaka till profilen
        </a>

        <section className="mt-6 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-black/10 sm:p-9">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e8f2ec] text-[#173e2b]">
            <Building2 className="h-6 w-6" />
          </div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.16em] text-[#54705e]">Gör anspråk på företaget</p>
          <h1 className="mt-2 text-3xl font-black">{business.companyName}</h1>
          <p className="mt-3 text-sm leading-6 text-[#5d685f]">
            Anspråket tillhör alltid det Proffera-konto som är inloggat. Ingen får kontroll över profilen förrän företagsmejlen och rätten att företräda företaget har verifierats.
          </p>

          {message ? (
            <div className="mt-7 rounded-2xl border border-[#cfe1d4] bg-[#f1f8f3] p-5">
              <p className="font-black text-[#173e2b]">{message.title}</p>
              <p className="mt-1 text-sm leading-6 text-[#536057]">{message.body}</p>
            </div>
          ) : null}

          <div className="mt-7 grid gap-3">
            <div className="flex gap-3 rounded-2xl bg-[#f7f8f6] p-4">
              <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#173e2b]" />
              <div><p className="font-bold">Företaget matchas mot officiella uppgifter</p><p className="mt-1 text-sm text-[#687169]">Namn, status och bransch ändras inte av ett anspråk.</p></div>
            </div>
            <div className="flex gap-3 rounded-2xl bg-[#f7f8f6] p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#173e2b]" />
              <div><p className="font-bold">Ingen workspace skapas utan verifiering</p><p className="mt-1 text-sm text-[#687169]">Verifierat mejl räcker inte ensamt. Proffera gör också en manuell kontroll av behörigheten.</p></div>
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
                        <p className="font-black">Verifiera med BankID</p>
                        <span className="rounded-full bg-[#edf0ed] px-2.5 py-1 text-[11px] font-black text-[#617067]">VALFRITT · KOMMER SNART</span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-[#687169]">Snabbare identitetskontroll. BankID är inte ett krav och inga BankID-anrop eller kostnader aktiveras i Proffera nu.</p>
                    </div>
                  </div>
                </div>
                <button type="button" disabled className="mt-4 min-h-11 w-full cursor-not-allowed rounded-xl border border-[#d7ddd8] bg-white px-4 text-sm font-black text-[#8a938d]">
                  BankID aktiveras senare
                </button>
              </div>

              {challengeActive ? (
                <div className="rounded-2xl border border-[#cfe1d4] bg-[#f3f8f4] p-5">
                  <div className="flex items-start gap-3">
                    <KeyRound className="mt-0.5 h-6 w-6 shrink-0 text-[#173e2b]" />
                    <div>
                      <p className="font-black">Verifiera företagsmejlen</p>
                      <p className="mt-1 text-sm leading-6 text-[#5f6c63]">En sexsiffrig kod skickades till <strong>{emailEvidence?.businessEmail ?? "företagsmejlen"}</strong>.</p>
                      {emailEvidence?.emailDomainKind === "public_mailbox" ? (
                        <p className="mt-2 rounded-lg bg-[#fff5da] px-3 py-2 text-xs leading-5 text-[#76580d]">Det här är en extern e-postleverantör. Proffera kommer därför att kräva extra manuell kontroll innan anspråket kan godkännas.</p>
                      ) : null}
                    </div>
                  </div>

                  <form action="/api/public-directory/claim-email/verify" method="post" className="mt-5">
                    <input type="hidden" name="slug" value={business.slug} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <label className="text-sm font-bold text-[#334139]">
                      Verifieringskod
                      <input
                        name="code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        minLength={6}
                        maxLength={6}
                        required
                        disabled={challengeLocked || challengeExpired}
                        placeholder="000000"
                        className="mt-2 min-h-12 w-full rounded-xl border border-[#cad8ce] bg-white px-4 text-center text-xl font-black tracking-[0.35em] outline-none focus:ring-2 focus:ring-[#17452f]/20 disabled:bg-[#eef0ed] disabled:text-[#89908b]"
                      />
                    </label>
                    <button type="submit" disabled={challengeLocked || challengeExpired} className="mt-4 min-h-12 w-full rounded-xl bg-[#173e2b] px-5 font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
                      Verifiera mejl och skicka till granskning
                    </button>
                  </form>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <form action="/api/public-directory/claim-email/send" method="post">
                      <input type="hidden" name="slug" value={business.slug} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <input type="hidden" name="action" value="resend" />
                      <button type="submit" className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#cbd8ce] bg-white px-4 text-sm font-black text-[#17452f]">
                        <RefreshCw className="h-4 w-4" /> Skicka ny kod
                      </button>
                    </form>
                    <form action="/api/public-directory/claim-email/send" method="post">
                      <input type="hidden" name="slug" value={business.slug} />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <input type="hidden" name="action" value="reset" />
                      <button type="submit" className="min-h-11 w-full rounded-xl border border-[#d7ddd8] bg-white px-4 text-sm font-bold text-[#687169]">Ändra uppgifter</button>
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
                        <p className="font-black">E-post + manuell verifiering</p>
                        <span className="rounded-full bg-[#e4f2e8] px-2.5 py-1 text-[11px] font-black text-[#17452f]">KOSTNADSFRI</span>
                      </div>
                      <p className="mt-1 text-sm leading-6 text-[#5f6c63]">Först verifierar vi att du har tillgång till företagsmejlen. Därefter granskar Proffera manuellt att du får företräda företaget.</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="text-sm font-bold text-[#334139]">
                      Ditt namn
                      <input name="claimantName" required minLength={2} maxLength={100} defaultValue={session.user.name ?? ""} autoComplete="name" className="mt-2 min-h-11 w-full rounded-xl border border-[#cad8ce] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#17452f]/20" />
                    </label>
                    <label className="text-sm font-bold text-[#334139]">
                      Din roll i företaget
                      <input name="role" required minLength={2} maxLength={80} placeholder="Ex. ägare, VD, firmatecknare" className="mt-2 min-h-11 w-full rounded-xl border border-[#cad8ce] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#17452f]/20" />
                    </label>
                    <label className="text-sm font-bold text-[#334139]">
                      Företagsmejl
                      <input name="businessEmail" type="email" required maxLength={254} autoComplete="email" placeholder="namn@foretag.se" className="mt-2 min-h-11 w-full rounded-xl border border-[#cad8ce] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#17452f]/20" />
                    </label>
                    <label className="text-sm font-bold text-[#334139]">
                      Telefonnummer <span className="font-normal text-[#778078]">(valfritt)</span>
                      <input name="phone" type="tel" maxLength={40} autoComplete="tel" className="mt-2 min-h-11 w-full rounded-xl border border-[#cad8ce] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[#17452f]/20" />
                    </label>
                  </div>

                  <label className="mt-5 flex items-start gap-3 rounded-xl bg-white p-4 text-sm leading-6 text-[#4f5c53] ring-1 ring-black/5">
                    <input type="checkbox" name="confirmAuthority" value="yes" required className="mt-1 h-4 w-4 accent-[#17452f]" />
                    <span>Jag bekräftar att jag själv använder detta Proffera-konto och att uppgifterna ovan är korrekta. Jag förstår att verifiering av mejlet inte ger åtkomst innan Proffera även har verifierat min behörighet till företaget.</span>
                  </label>

                  <button type="submit" className="mt-5 min-h-12 w-full rounded-xl bg-[#173e2b] px-5 font-black text-white">
                    Skicka kod till företagsmejlen
                  </button>
                  <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs leading-5 text-[#707870]"><Mail className="h-3.5 w-3.5" /> Inloggad som {session.user.email ?? "Proffera-användare"}</p>
                </form>
              )}
            </div>
          ) : (
            <a href={`/logga-in?next=${encodeURIComponent(returnTo)}`} className="mt-8 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#173e2b] px-5 font-black text-white">
              Logga in för att fortsätta
            </a>
          ) : null}
        </section>
      </div>
    </main>
  );
}
