import { redirect } from "next/navigation";

import { resendPublicBookingCode, verifyPublicBookingCode } from "@/lib/public-booking-verification";
import { publicBookingSuccessRedirect } from "@/lib/public-booking-success-redirect";
import styles from "../../[slug]/public-booking-marketplace.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string | string[]; lang?: string | string[]; resent?: string | string[]; channel?: string | string[] }>;
};

type Locale = "sv" | "en";
const messages: Record<Locale, Record<string, string>> = {
  sv: {
    invalid: "Verifieringsförfrågan är ogiltig.", expired: "Koden har gått ut. Skicka en ny kod.", attempts: "För många felaktiga försök. Skicka en ny kod.", code: "Koden stämmer inte. Kontrollera mejlet eller SMS:et och försök igen.", conflict: "Tiden hann bli bokad. Välj en ny tid.", save: "Bokningen kunde inte sparas. Försök igen.", wait: "Vänta minst 30 sekunder innan du skickar en ny kod.", email: "Koden kunde inte skickas just nu. Försök igen om en stund.",
  },
  en: {
    invalid: "The verification request is invalid.", expired: "The code has expired. Send a new code.", attempts: "Too many incorrect attempts. Send a new code.", code: "That code is incorrect. Check your email or SMS and try again.", conflict: "That time has just been booked. Please choose a new time.", save: "The booking could not be saved. Please try again.", wait: "Please wait at least 30 seconds before sending another code.", email: "We could not send a code right now. Please try again in a moment.",
  },
};

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function channelSuffix(channel: string) { return channel ? `&channel=${encodeURIComponent(channel)}` : ""; }
function verificationHref(id: string, locale: Locale, channel: string) {
  const query = new URLSearchParams();
  if (locale === "en") query.set("lang", "en");
  if (channel) query.set("channel", channel);
  const suffix = query.toString();
  return `/boka/verifiera/${id}${suffix ? `?${suffix}` : ""}`;
}

async function verify(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  const locale: Locale = formData.get("lang") === "en" ? "en" : "sv";
  const channel = String(formData.get("channel") ?? "");
  const result = await verifyPublicBookingCode(id, code);
  if (!result.ok) redirect(`/boka/verifiera/${id}?error=${result.error}${locale === "en" ? "&lang=en" : ""}${channelSuffix(channel)}`);
  redirect(publicBookingSuccessRedirect(result.slug, locale));
}

async function resend(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const locale: Locale = formData.get("lang") === "en" ? "en" : "sv";
  const result = await resendPublicBookingCode(id, locale);
  if (!result.ok) redirect(`/boka/verifiera/${id}?error=${result.error}${locale === "en" ? "&lang=en" : ""}`);
  redirect(`/boka/verifiera/${id}?resent=1${locale === "en" ? "&lang=en" : ""}&channel=${encodeURIComponent(result.delivery)}`);
}

export default async function VerifyBookingPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = searchParams ? await searchParams : undefined;
  const locale: Locale = first(query?.lang) === "en" ? "en" : "sv";
  const isEnglish = locale === "en";
  const error = messages[locale][first(query?.error) ?? ""];
  const resent = first(query?.resent) === "1";
  const channel = first(query?.channel) ?? "email";
  const deliveryText = isEnglish
    ? channel === "sms"
      ? "We sent a six-digit code by SMS. It is valid for 10 minutes."
      : channel === "email_sms"
        ? "We sent a six-digit code to your email and phone. It is valid for 10 minutes."
        : "We sent a six-digit code to your email. It is valid for 10 minutes."
    : channel === "sms"
      ? "Vi har skickat en sexsiffrig kod via SMS. Koden gäller i 10 minuter."
      : channel === "email_sms"
        ? "Vi har skickat en sexsiffrig kod till din e-post och telefon. Koden gäller i 10 minuter."
        : "Vi har skickat en sexsiffrig kod till din e-post. Koden gäller i 10 minuter.";

  return (
    <main className={styles.verifyPage} lang={locale}>
      <div className={styles.verifyShell}>
        <nav className={styles.languageNav} aria-label={isEnglish ? "Language" : "Språk"}>
          <a href={verificationHref(id, "sv", channel)} className={locale === "sv" ? styles.languageActive : styles.languageLink}>SV</a>
          <a href={verificationHref(id, "en", channel)} className={locale === "en" ? styles.languageActive : styles.languageLink}>EN</a>
        </nav>

        <section className={styles.verifyCard}>
          <p className={styles.verifyEyebrow}>{isEnglish ? "Verify booking" : "Verifiera bokning"}</p>
          <h1 className={styles.verifyTitle}>{isEnglish ? "Enter your verification code" : "Ange din verifieringskod"}</h1>
          <p className={styles.verifyLead}>
            {deliveryText} {isEnglish ? "The booking is created only after the code is verified." : "Bokningen skapas först när koden har verifierats."}
          </p>

          {resent ? <p className={styles.verifySuccess}>{isEnglish ? "A new code has been sent." : "En ny kod har skickats."}</p> : null}
          {error ? <p role="alert" className={styles.verifyError}>{error}</p> : null}

          <form action={verify} className={styles.verifyForm}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="lang" value={locale} />
            <input type="hidden" name="channel" value={channel} />
            <label className={styles.verifyLabel}>
              {isEnglish ? "Verification code" : "Verifieringskod"}
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                minLength={6}
                maxLength={6}
                required
                autoFocus
                className={styles.codeInput}
              />
            </label>
            <button className={styles.verifyPrimary}>
              {isEnglish ? "Verify and create booking" : "Verifiera och skapa bokning"}
            </button>
          </form>

          <form action={resend} className="mt-3">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="lang" value={locale} />
            <button type="submit" className={styles.verifySecondary}>
              {isEnglish ? "Didn't receive it? Send a new code" : "Fick du ingen kod? Skicka en ny"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
