import { redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { readableBookingTextColor } from "@/lib/booking-theme-contract";
import { getSql } from "@/lib/db/server";
import { resolvePublicBusinessLocale } from "@/lib/public-business-locale";
import { resendPublicBookingCode, verifyPublicBookingCode } from "@/lib/public-booking-verification";
import { publicBookingSuccessRedirect } from "@/lib/public-booking-success-redirect";
import { getPublicWorkspaceExperienceSettings } from "@/lib/workspace-experience";
import styles from "../../[slug]/public-booking-marketplace.module.css";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string | string[]; lang?: string | string[]; resent?: string | string[]; channel?: string | string[] }>;
};

type Locale = "sv" | "en" | "ar";
type VerificationExperience = {
  defaultLanguage: "sv" | "en";
  swedishEnabled: boolean;
  englishEnabled: boolean;
  primaryColor: string;
  mariaPreview: boolean;
};

const safeVerificationExperience: VerificationExperience = {
  defaultLanguage: "sv",
  swedishEnabled: true,
  englishEnabled: false,
  primaryColor: "#17452f",
  mariaPreview: false,
};

const messages: Record<Locale, Record<string, string>> = {
  sv: {
    invalid: "Verifieringsförfrågan är ogiltig.", expired: "Koden har gått ut. Skicka en ny kod.", attempts: "För många felaktiga försök. Skicka en ny kod.", code: "Koden stämmer inte. Kontrollera mejlet eller SMS:et och försök igen.", conflict: "Tiden hann bli bokad. Välj en ny tid.", save: "Bokningen kunde inte sparas. Försök igen.", wait: "Vänta minst 30 sekunder innan du skickar en ny kod.", email: "Koden kunde inte skickas just nu. Försök igen om en stund.",
  },
  en: {
    invalid: "The verification request is invalid.", expired: "The code has expired. Send a new code.", attempts: "Too many incorrect attempts. Send a new code.", code: "That code is incorrect. Check your email or SMS and try again.", conflict: "That time has just been booked. Please choose a new time.", save: "The booking could not be saved. Please try again.", wait: "Please wait at least 30 seconds before sending another code.", email: "We could not send a code right now. Please try again in a moment.",
  },
  ar: {
    invalid: "طلب التحقق غير صالح.", expired: "انتهت صلاحية الرمز. اطلب رمزًا جديدًا.", attempts: "محاولات غير صحيحة كثيرة. اطلب رمزًا جديدًا.", code: "الرمز غير صحيح. تحقّق من بريدك الإلكتروني وحاول مجددًا.", conflict: "تم حجز هذا الموعد. اختر وقتًا آخر.", save: "تعذّر حفظ الحجز. حاول مجددًا.", wait: "انتظر 30 ثانية على الأقل قبل طلب رمز جديد.", email: "تعذّر إرسال الرمز الآن. حاول لاحقًا.",
  },
};

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }
function channelSuffix(channel: string) { return channel ? `&channel=${encodeURIComponent(channel)}` : ""; }
function verificationHref(id: string, locale: Locale, channel: string) {
  const query = new URLSearchParams();
  query.set("lang", locale);
  if (channel) query.set("channel", channel);
  const suffix = query.toString();
  return `/boka/verifiera/${id}${suffix ? `?${suffix}` : ""}`;
}

async function getVerificationExperience(id: string): Promise<VerificationExperience> {
  const sql = getSql();
  if (!sql || !/^[0-9a-f-]{36}$/i.test(id)) return safeVerificationExperience;

  try {
    const rows = await sql`
      select v.workspace_id, w.slug as workspace_slug
      from public_booking_verifications v
      join workspaces w on w.id = v.workspace_id
      where v.id = ${id}::uuid
      limit 1
    `;
    const workspaceId = String(rows[0]?.workspace_id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(workspaceId)) return safeVerificationExperience;

    const experience = await getPublicWorkspaceExperienceSettings(workspaceId);
    const mariaPreview = process.env.VERCEL_ENV === "preview"
      && String(rows[0]?.workspace_slug) === "makeup-by-maria";
    if (
      typeof experience.swedishEnabled !== "boolean"
      || typeof experience.englishEnabled !== "boolean"
      || (!experience.swedishEnabled && !experience.englishEnabled)
    ) return safeVerificationExperience;

    return {
      defaultLanguage: experience.defaultLanguage === "en" ? "en" : "sv",
      swedishEnabled: experience.swedishEnabled,
      englishEnabled: experience.englishEnabled,
      primaryColor: /^#[0-9a-f]{6}$/i.test(experience.primaryColor) ? experience.primaryColor : safeVerificationExperience.primaryColor,
      mariaPreview,
    };
  } catch {
    return safeVerificationExperience;
  }
}

async function verify(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  const experience = await getVerificationExperience(id);
  const wanted = String(formData.get("lang") ?? "");
  const locale: Locale = experience.mariaPreview && wanted === "ar"
    ? "ar" : resolvePublicBusinessLocale(experience, wanted);
  const channel = String(formData.get("channel") ?? "");
  const result = await verifyPublicBookingCode(id, code, locale === "ar" ? "en" : locale);
  if (!result.ok) redirect(`/boka/verifiera/${id}?error=${result.error}&lang=${locale}${channelSuffix(channel)}`);
  redirect(publicBookingSuccessRedirect(result.slug, locale));
}

async function resend(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const experience = await getVerificationExperience(id);
  const wanted = String(formData.get("lang") ?? "");
  const locale: Locale = experience.mariaPreview && wanted === "ar"
    ? "ar" : resolvePublicBusinessLocale(experience, wanted);
  const result = await resendPublicBookingCode(id, locale === "ar" ? "en" : locale);
  if (!result.ok) redirect(`/boka/verifiera/${id}?error=${result.error}&lang=${locale}`);
  redirect(`/boka/verifiera/${id}?resent=1&lang=${locale}&channel=${encodeURIComponent(result.delivery)}`);
}

export default async function VerifyBookingPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const query = searchParams ? await searchParams : undefined;
  const experience = await getVerificationExperience(id);
  const wanted = first(query?.lang);
  const locale: Locale = experience.mariaPreview && wanted === "ar"
    ? "ar" : resolvePublicBusinessLocale(experience, wanted);
  const isEnglish = locale === "en";
  const error = messages[locale][first(query?.error) ?? ""];
  const resent = first(query?.resent) === "1";
  const channel = first(query?.channel) ?? "email";
  const deliveryText = locale === "ar"
    ? "أرسلنا رمزًا مكوّنًا من ستة أرقام إلى بريدك الإلكتروني. الرمز صالح لمدة 10 دقائق."
    : isEnglish
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

  const themeStyles = {
    "--booking-primary": experience.primaryColor,
    "--booking-primary-text": readableBookingTextColor(experience.primaryColor),
  } as CSSProperties;

  return (
    <main className={styles.verifyPage} lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} style={themeStyles}>
      <div className={styles.verifyShell}>
        <nav className={styles.languageNav} aria-label={locale === "ar" ? "اللغة" : isEnglish ? "Language" : "Språk"}>
          {experience.swedishEnabled ? <a href={verificationHref(id, "sv", channel)} className={locale === "sv" ? styles.languageActive : styles.languageLink}>SV</a> : null}
          {experience.englishEnabled ? <a href={verificationHref(id, "en", channel)} className={locale === "en" ? styles.languageActive : styles.languageLink}>EN</a> : null}
          {experience.mariaPreview ? <a href={verificationHref(id, "ar", channel)} className={locale === "ar" ? styles.languageActive : styles.languageLink}>AR</a> : null}
        </nav>

        <section className={styles.verifyCard}>
          <p className={styles.verifyEyebrow}>{locale === "ar" ? "تأكيد الحجز" : isEnglish ? "Verify booking" : "Verifiera bokning"}</p>
          <h1 className={styles.verifyTitle}>{locale === "ar" ? "أدخل رمز التحقق" : isEnglish ? "Enter your verification code" : "Ange din verifieringskod"}</h1>
          <p className={styles.verifyLead}>
            {deliveryText} {locale === "ar" ? "لن يتم إنشاء الحجز إلا بعد التحقق من الرمز." : isEnglish ? "The booking is created only after the code is verified." : "Bokningen skapas först när koden har verifierats."}
          </p>

          {resent ? <p className={styles.verifySuccess}>{locale === "ar" ? "تم إرسال رمز جديد." : isEnglish ? "A new code has been sent." : "En ny kod har skickats."}</p> : null}
          {error ? <p role="alert" className={styles.verifyError}>{error}</p> : null}

          <form action={verify} className={styles.verifyForm}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="lang" value={locale} />
            <input type="hidden" name="channel" value={channel} />
            <label className={styles.verifyLabel}>
              {locale === "ar" ? "رمز التحقق" : isEnglish ? "Verification code" : "Verifieringskod"}
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
              {locale === "ar" ? "تحقق وأنشئ الحجز" : isEnglish ? "Verify and create booking" : "Verifiera och skapa bokning"}
            </button>
          </form>

          <form action={resend} className="mt-3">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="lang" value={locale} />
            <button type="submit" className={styles.verifySecondary}>
              {locale === "ar" ? "لم يصلك الرمز؟ أرسل رمزًا جديدًا" : isEnglish ? "Didn't receive it? Send a new code" : "Fick du ingen kod? Skicka en ny"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}