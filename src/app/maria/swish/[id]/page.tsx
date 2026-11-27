import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MariaBookingReferenceCopy } from "@/components/dashboard/maria-booking-reference-copy";
import { readMariaSwishQrEligibility } from "@/lib/maria-swish-qr-eligibility";
import { readMariaBookingReference } from "@/lib/maria-booking-reference-db";
import {
  MARIA_DEPOSIT_AMOUNT_SEK, MARIA_SWISH_NUMBER,
  mariaSwishPaymentLink, mariaSwishQrPath,
} from "@/lib/maria-deposit";
import { getMariaBookingReadiness } from "@/lib/maria-booking-runtime";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  // Keep customer payment previews and "Add to Home Screen" independent of
  // Proffera's root PWA manifest, Apple title and social sharing defaults.
  title: { absolute: "Swish-handpenning · Makeup by Maria" },
  applicationName: "Makeup by Maria",
  metadataBase: new URL("https://makeupbymaria.se"),
  description: "Swish-handpenning för din bokning hos Makeup by Maria.",
  manifest: null,
  appleWebApp: null,
  openGraph: null,
  twitter: null,
  robots: { index: false, follow: false },
  icons: { icon: "/demo/makeup-by-maria/assets/maria-client-logo.jpg", apple: "/demo/makeup-by-maria/assets/maria-apple-touch-icon.png" },
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const paymentText = {
  "sv": {
    "languageLabel": "Språk",
    "previewLabel": "Swish · Preview",
    "heading": "Swish-handpenning",
    "testWarning": "Endast test. Gör ingen riktig Swish-betalning och signera inget med BankID.",
    "amount": "Belopp",
    "merchant": "Swish företag",
    "message": "Meddelande i Swish",
    "open": "Öppna Swish",
    "help": "Den här knappen öppnar Swish direkt, utan e-postens spårningslänk. Om appen bara visar startsidan: öppna sidan i Safari eller kopiera numret och meddelandet ovan och ange dem manuellt i Swish.",
    "qrHeading": "Swish QR-kod",
    "qrAltPrefix": "Swish QR med 2 000 kr och meddelandet",
    "qrHelp": "Skanna koden med Swish från en annan skärm. Kontrollera alltid mottagaren och beloppet innan du signerar en verklig betalning."
  },
  "en": {
    "languageLabel": "Language",
    "previewLabel": "Swish · Preview",
    "heading": "Swish deposit",
    "testWarning": "Test only. Do not make a real Swish payment or sign anything with BankID.",
    "amount": "Amount",
    "merchant": "Business Swish",
    "message": "Swish message",
    "open": "Open Swish",
    "help": "This button opens Swish directly, without an email tracking link. If the app only opens the home screen, try Safari or copy the Swish number and message above and enter them manually in Swish.",
    "qrHeading": "Swish QR code",
    "qrAltPrefix": "Swish QR with SEK 2,000 and booking message",
    "qrHelp": "Scan the code with Swish from another screen. Always check the recipient and amount before approving any real payment."
  },
  "ar": {
    "languageLabel": "اللغة",
    "previewLabel": "Swish · نسخة تجريبية",
    "heading": "دفع العربون عبر Swish",
    "testWarning": "للاختبار فقط. لا تجري أي دفع حقيقي عبر Swish ولا توقّعي باستخدام BankID.",
    "amount": "المبلغ",
    "merchant": "رقم Swish للشركة",
    "message": "الرسالة في Swish",
    "open": "فتح Swish",
    "help": "يفتح هذا الزر تطبيق Swish مباشرةً دون رابط تتبّع البريد الإلكتروني. إذا ظهرت الصفحة الرئيسية فقط، افتحي الرابط في Safari أو انسخي رقم Swish ورقم الحجز وأدخليهما يدويًا.",
    "qrHeading": "رمز QR للدفع عبر Swish",
    "qrAltPrefix": "رمز QR بمبلغ 2,000 كرونة ورقم الحجز",
    "qrHelp": "امسحي الرمز باستخدام Swish من شاشة أخرى. تحققي دائمًا من المستلم والمبلغ قبل الموافقة على أي دفع حقيقي."
  }
} as const;

/**
 * First-party landing page guarded by Maria booking readiness. Brevo's email click tracker may
 * redirect users to this page, but the Swish universal link itself is a
 * direct user-activated navigation, not an email-service redirect.
 * Never marks payment as received or initiates a Swish Commerce request.
 */
export default async function MariaSwishPaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ lang?: string | string[] }>;
}) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const preview = process.env.VERCEL_ENV === "preview";
  const readiness = preview ? await getMariaBookingReadiness() : null;
  if (preview && !readiness?.enabled) notFound();
  // Intake can be closed without hiding already-confirmed unpaid payment links.
  if (!preview && process.env.VERCEL_ENV !== "production") notFound();

  // Use the same eligibility rules as the QR endpoint; never show
  // payment details that the QR endpoint would reject.
  let eligible = false;
  try {
    eligible = await readMariaSwishQrEligibility(id, readiness?.enabled ? readiness.workspaceId : undefined) === "eligible";
  } catch (error) {
    console.error("Maria Swish payment page unavailable", error);
  }
  if (!eligible) notFound();

  const requestedLanguage = (await searchParams)?.lang;
  const language = requestedLanguage === "en" || requestedLanguage === "ar" ? requestedLanguage : "sv";
  const isEnglish = language === "en";
  const words = paymentText[language];
  const paymentPagePath = "/maria/swish/" + id;
  let reference: string;
  try {
    reference = await readMariaBookingReference(id);
  } catch (error) {
    console.error("Maria Swish booking reference unavailable", error);
    notFound();
  }
  const swishDigits = MARIA_SWISH_NUMBER.replace(/\D/g, "");

  return (
    <main lang={language} dir={language === "ar" ? "rtl" : "ltr"} className="min-h-screen min-w-0 bg-[#fcfaf8] px-4 py-10 text-[#352a2c]">
      <article className="mx-auto min-w-0 max-w-lg overflow-hidden rounded-2xl border border-[#e9dedc] bg-white p-5 shadow-sm sm:p-8">
        <header className="flex items-center gap-3 border-b border-[#e9dedc] pb-5">
          <Image
            src="/demo/makeup-by-maria/assets/maria-client-logo.jpg"
            alt="Makeup by Maria"
            width={76}
            height={76}
            unoptimized
            className="h-[76px] w-[76px] rounded-lg object-cover"
          />
          <div>
            <p className="font-serif text-xl text-[#6d3e4e]">Makeup by Maria</p>
            <p className="text-xs font-bold uppercase tracking-widest text-[#845363]">{preview ? words.previewLabel : "Swish"}</p>
          </div>
        </header>
        <nav aria-label={words.languageLabel} className="mt-4 flex justify-end gap-3 text-sm font-semibold">
          <Link href={paymentPagePath + "?lang=sv"} lang="sv"
            aria-current={language === "sv" ? "page" : undefined}
            className={language === "sv" ? "text-[#6d3e4e] underline" : "text-[#76545f] hover:underline"}>Svenska</Link>
          <Link href={paymentPagePath + "?lang=en"} lang="en"
            aria-current={isEnglish ? "page" : undefined}
            className={isEnglish ? "text-[#6d3e4e] underline" : "text-[#76545f] hover:underline"}>English</Link>
          <Link href={paymentPagePath + "?lang=ar"} lang="ar"
            aria-current={language === "ar" ? "page" : undefined}
            className={language === "ar" ? "text-[#6d3e4e] underline" : "text-[#76545f] hover:underline"}>العربية</Link>
        </nav>
        <h1 className="mt-3 font-serif text-3xl text-[#6d3e4e]">{words.heading}</h1>
        {preview ? <p role="alert" className="mt-5 rounded-lg border border-[#e6c4cb] bg-[#faefed] p-4 text-sm font-bold text-[#8b2d39]">
          {words.testWarning}
        </p> : null}

        <div className="mt-6 space-y-5">
          <div>
            <p className="text-sm text-[#76545f]">{words.amount}</p>
            <p className="text-3xl font-bold">{MARIA_DEPOSIT_AMOUNT_SEK.toLocaleString(language === "sv" ? "sv-SE" : "en-GB")} {language === "sv" ? "kr" : "SEK"}</p>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#76545f]">{words.merchant}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code dir="ltr" className="min-w-0 break-all select-all text-lg font-bold">{MARIA_SWISH_NUMBER}</code>
              <MariaBookingReferenceCopy reference={swishDigits} kind="swish" isEnglish={isEnglish} language={language} />
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-[#76545f]">{words.message}</p>
            <div className="flex flex-wrap items-center gap-2">
              <code dir="ltr" className="min-w-0 break-all select-all text-lg font-bold">{reference}</code>
              <MariaBookingReferenceCopy reference={reference} isEnglish={isEnglish} language={language} />
            </div>
          </div>
        </div>

        <a
          href={mariaSwishPaymentLink(id, reference)}
          className="mt-7 flex min-h-12 w-full items-center justify-center rounded-xl bg-[#845363] px-5 py-3 text-center font-bold text-white hover:bg-[#6d3e4e]"
        >
          {words.open}
        </a>
        <p className="mt-3 text-sm leading-6 text-[#76545f]">
          {words.help}
        </p>

        <div className="mt-7 border-t border-[#e9dedc] pt-6">
          <h2 className="text-lg font-bold">{words.qrHeading}</h2>
          <Image
            src={mariaSwishQrPath(id)}
            alt={`${words.qrAltPrefix} ${reference}`}
            width={380}
            height={380}
            unoptimized
            className="mx-auto mt-3 h-auto w-full max-w-[340px] rounded-lg bg-white"
          />
          <p className="mt-2 text-sm leading-6 text-[#76545f]">
            {words.qrHelp}
          </p>
        </div>
      </article>
    </main>
  );
}
