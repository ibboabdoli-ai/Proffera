import { redirect } from "next/navigation";

import { resendPublicBookingCode, verifyPublicBookingCode } from "@/lib/public-booking-verification";

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

async function verify(formData: FormData) {
  "use server";
  const id = String(formData.get("id") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  const locale: Locale = formData.get("lang") === "en" ? "en" : "sv";
  const channel = String(formData.get("channel") ?? "");
  const result = await verifyPublicBookingCode(id, code);
  if (!result.ok) redirect(`/boka/verifiera/${id}?error=${result.error}${locale === "en" ? "&lang=en" : ""}${channelSuffix(channel)}`);
  if (result.slug === "primeview") redirect("/booking?booked=1");
  redirect(`/boka/${result.slug}?booked=1${locale === "en" ? "&lang=en" : ""}`);
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
    <main className="min-h-screen bg-[#f7f7f4] px-4 py-16 sm:px-6">
      <section className="mx-auto max-w-md rounded-[2rem] bg-white p-7 shadow-sm ring-1 ring-[#dfe5dd] sm:p-9">
        <p className="text-sm font-bold uppercase tracking-[.16em] text-[#17452f]">{isEnglish ? "Verify booking" : "Verifiera bokning"}</p>
        <h1 className="mt-3 text-3xl font-bold text-[#17201a]">{isEnglish ? "Enter your verification code" : "Ange din verifieringskod"}</h1>
        <p className="mt-3 text-sm leading-6 text-[#5b665f]">{deliveryText} {isEnglish ? "The booking is created only after the code is verified." : "Bokningen skapas först när koden har verifierats."}</p>
        {resent ? <p className="mt-5 rounded-xl bg-[#eef8f1] p-4 text-sm font-semibold text-[#17452f] ring-1 ring-[#c9e2d0]">{isEnglish ? "A new code has been sent." : "En ny kod har skickats."}</p> : null}
        {error ? <p role="alert" className="mt-5 rounded-xl bg-[#fff5f2] p-4 text-sm font-semibold text-[#8f2f1b] ring-1 ring-[#f4c7ba]">{error}</p> : null}
        <form action={verify} className="mt-6 grid gap-4">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="lang" value={locale} />
          <input type="hidden" name="channel" value={channel} />
          <label className="grid gap-2 text-sm font-bold text-[#17201a]">
            {isEnglish ? "Verification code" : "Verifieringskod"}
            <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoFocus className="rounded-xl border border-[#cfd9d0] px-4 py-3 text-center text-2xl font-black tracking-[.35em] outline-none focus:border-[#17452f]" />
          </label>
          <button className="rounded-xl bg-[#17452f] px-4 py-3 font-bold text-white hover:bg-[#123923]">{isEnglish ? "Verify and create booking" : "Verifiera och skapa bokning"}</button>
        </form>
        <form action={resend} className="mt-4">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="lang" value={locale} />
          <button type="submit" className="w-full rounded-xl border border-[#cfd9d0] bg-white px-4 py-3 text-sm font-bold text-[#17452f] hover:bg-[#f5f8f5]">{isEnglish ? "Didn't receive it? Send a new code" : "Fick du ingen kod? Skicka en ny"}</button>
        </form>
      </section>
    </main>
  );
}
