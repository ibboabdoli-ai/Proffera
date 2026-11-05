import "server-only";

import { mariaEmailLogoHtml } from "@/lib/maria-email-logo";
import { bookingDateLocale } from "@/lib/booking-date-locale";

import { getMariaPreviewPortalBase, isMariaPreviewTestRecipient } from "@/lib/maria-preview-customer-safety";
import {
  MARIA_DEPOSIT_AMOUNT_SEK, MARIA_SWISH_NUMBER, mariaSwishPaymentPagePath,
  mariaSwishQrPath, mariaBookingNumber, mariaDepositDeadline,
} from "@/lib/maria-deposit";
import type { WorkspaceTimeZone } from "@/lib/workspace-market";

export type MariaBookingStatusEmailInput = {
  bookingId: string;
  status: "confirmed" | "cancelled";
  customerName: string;
  customerEmail: string;
  companyName: string;
  service: string;
  startsAt: string;
  endsAt: string;
  city: string;
  timeZone?: WorkspaceTimeZone;
  confirmedAt?: Date;
  language?: "sv" | "en" | "ar";
};

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatTime(value: string | Date, timeZone: WorkspaceTimeZone = "Europe/Stockholm", language: "sv" | "en" | "ar" = "sv") {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("INVALID_MARIA_BOOKING_TIME");
  return new Intl.DateTimeFormat(bookingDateLocale(language), { timeZone, dateStyle: "full", timeStyle: "short" }).format(date);
}

function checkedPreviewOrigin(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !/^[a-z0-9][a-z0-9.-]*\.vercel\.app$/i.test(url.hostname)
    || url.username || url.password || url.port || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("INVALID_MARIA_PREVIEW_ORIGIN");
  }
  return url.origin;
}

/** Pure builder: no email, banking, or database operations. */
export function buildMariaBookingStatusEmail(input: MariaBookingStatusEmailInput, previewOrigin: string) {
  const origin = checkedPreviewOrigin(previewOrigin);
  const logo = mariaEmailLogoHtml(origin);
  const reference = mariaBookingNumber(input.bookingId);
  const language = input.language === "en" || input.language === "ar" ? input.language : "sv";
  const start = formatTime(input.startsAt, input.timeZone, language);
  const end = formatTime(input.endsAt, input.timeZone, language);
  const isConfirmation = input.status === "confirmed";
  // The Swedish copy below is the unchanged default. The customer's saved
  // booking language selects explicit English or Arabic transactional copy.
  if (language !== "sv") {
    const copy = language === "en" ? {
      greeting: "Hello", confirmed: "Your booking is confirmed",
      cancelled: "Your booking has been cancelled",
      confirmedIntro: "Maria has confirmed your booking with",
      cancelledIntro: "Your booking has been cancelled. You are welcome to book again.",
      number: "Booking number", service: "Service", time: "Time",
      preview: "Preview test only – do not make a real Swish payment.",
      deposit: "Deposit", deadline: "Pay within 24 hours of confirmation, no later than",
      payee: "Swish business", details: "View payment details",
      qr: "Booking-specific QR code",
      reference: "Enter this exact booking number in the Swish message field",
      safety: "The QR code contains the recipient, 2,000 SEK and the booking reference. Always check the recipient in Swish before approving. Payment is not verified automatically.",
      cancelPolicy: "If the deposit is not registered within 24 hours, Maria may cancel manually. There is no automatic cancellation.",
      signoff: "Kind regards",
    } : {
      greeting: "مرحبًا", confirmed: "تم تأكيد حجزك",
      cancelled: "تم إلغاء حجزك",
      confirmedIntro: "أكدت ماريا حجزك لدى",
      cancelledIntro: "تم إلغاء حجزك. يسعدنا استقبال حجز جديد منك.",
      number: "رقم الحجز", service: "الخدمة", time: "الموعد",
      preview: "بيئة تجريبية فقط – لا تقومي بأي دفع حقيقي عبر Swish.",
      deposit: "العربون", deadline: "يُدفع خلال ٢٤ ساعة من التأكيد، وبحد أقصى",
      payee: "رقم Swish للشركة", details: "عرض تفاصيل الدفع",
      qr: "رمز QR خاص بهذا الحجز",
      reference: "اكتبي رقم الحجز نفسه في خانة الرسالة في Swish",
      safety: "يتضمن رمز QR المستلم ومبلغ ٢٬٠٠٠ كرونة ورقم الحجز. تحققي من المستلم قبل التأكيد في Swish. لا يوجد تحقق آلي من الدفع.",
      cancelPolicy: "إذا لم يُسجل العربون خلال ٢٤ ساعة، يمكن لماريا إلغاء الحجز يدويًا. لن يُلغى تلقائيًا.",
      signoff: "مع أطيب التحيات",
    };
    const due = isConfirmation ? formatTime(mariaDepositDeadline(input.confirmedAt ?? new Date()), input.timeZone, language) : "";
    const qrUrl = isConfirmation ? new URL(mariaSwishQrPath(input.bookingId), origin).toString() : "";
    const paymentPageUrl = isConfirmation ? new URL(mariaSwishPaymentPagePath(input.bookingId), origin).toString() : "";
    const payment = MARIA_DEPOSIT_AMOUNT_SEK.toLocaleString("sv-SE");
    const subject = isConfirmation
      ? `${copy.confirmed} – ${copy.deposit} ${payment} SEK – ${reference}`
      : `${copy.cancelled} – ${input.companyName}`;
    const text = [
      `${copy.greeting} ${input.customerName},`, "",
      isConfirmation ? `${copy.confirmedIntro} ${input.companyName}.` : copy.cancelledIntro,
      `${copy.number}: ${reference}`,
      `${copy.service}: ${input.service}`,
      `${copy.time}: ${start} – ${end}`,
      ...(isConfirmation ? [
        "", copy.preview,
        `${copy.deposit}: ${payment} SEK`,
        `${copy.deadline} ${due}.`,
        `${copy.payee}: ${MARIA_SWISH_NUMBER}`,
        `${copy.details}: ${paymentPageUrl}`,
        `${copy.qr}: ${qrUrl}`,
        `${copy.reference}: ${reference}`,
        copy.safety, copy.cancelPolicy,
      ] : []),
      "", copy.signoff, input.companyName,
    ].join("\n");
    const html = `<div lang="${language}" dir="${language === "ar" ? "rtl" : "ltr"}"
      style="max-width:640px;margin:0 auto;font:16px/1.7 Arial,sans-serif;color:#432a35;text-align:${language === "ar" ? "right" : "left"}">
      ${logo}
      <h1 style="color:#845363">${escapeHtml(isConfirmation ? copy.confirmed : copy.cancelled)}</h1>
      <p>${escapeHtml(copy.greeting)} ${escapeHtml(input.customerName)},</p>
      <p>${escapeHtml(isConfirmation ? copy.confirmedIntro : copy.cancelledIntro)}
        ${isConfirmation ? `<strong>${escapeHtml(input.companyName)}</strong>.` : ""}</p>
      <p><strong>${escapeHtml(copy.number)}:</strong> ${escapeHtml(reference)}<br/>
      <strong>${escapeHtml(copy.service)}:</strong> ${escapeHtml(input.service)}<br/>
      <strong>${escapeHtml(copy.time)}:</strong> ${escapeHtml(start)} – ${escapeHtml(end)}</p>
      ${isConfirmation ? `
        <p style="color:#8b2d39;font-weight:bold">${escapeHtml(copy.preview)}</p>
        <h2 style="color:#845363">${escapeHtml(copy.deposit)}: ${payment} SEK</h2>
        <p>${escapeHtml(copy.deadline)} ${escapeHtml(due)}.</p>
        <p><strong>${escapeHtml(copy.payee)}:</strong> ${escapeHtml(MARIA_SWISH_NUMBER)}</p>
        <p><img src="${escapeHtml(qrUrl)}" width="380" alt="${escapeHtml(copy.qr)}" style="max-width:100%;height:auto"/></p>
        <p><a href="${escapeHtml(paymentPageUrl)}">${escapeHtml(copy.details)}</a></p>
        <p><strong>${escapeHtml(copy.reference)}:</strong> ${escapeHtml(reference)}</p>
        <p>${escapeHtml(copy.safety)}</p>
        <p>${escapeHtml(copy.cancelPolicy)}</p>
      ` : ""}
      <p>${escapeHtml(copy.signoff)}<br/>${escapeHtml(input.companyName)}</p>
    </div>`;
    return { subject, text, html, reference };
  }
  const subject = isConfirmation
    ? `Din bokning är bekräftad – handpenning ${MARIA_DEPOSIT_AMOUNT_SEK.toLocaleString("sv-SE")} kr – ${reference}`
    : `Din bokning är avbokad – ${input.companyName}`;

  if (!isConfirmation) {
    const text = [
      `Hej ${input.customerName},`, "",
      "Din bokning är avbokad. Du får gärna komma tillbaka med en ny bokning.",
      `Bokningsnummer: ${reference}`,
      `Tjänst: ${input.service}`, `Tid: ${start} – ${end}`,
      "", "Välkommen åter!", input.companyName,
    ].join("\n");
    const html = `<div lang="sv" style="max-width:640px;margin:0 auto;font:16px/1.6 Arial,sans-serif;color:#432a35">
      ${logo}
      <h1 style="color:#845363">Din bokning är avbokad</h1>
      <p>Hej ${escapeHtml(input.customerName)},</p>
      <p>Din bokning är avbokad. <strong>Du får gärna komma tillbaka med en ny bokning.</strong></p>
      <p><strong>Bokningsnummer:</strong> ${escapeHtml(reference)}<br/>
      <strong>Tjänst:</strong> ${escapeHtml(input.service)}<br/>
      <strong>Tid:</strong> ${escapeHtml(start)} – ${escapeHtml(end)}</p>
      <p>Välkommen åter!<br/>${escapeHtml(input.companyName)}</p>
    </div>`;
    return { subject, text, html, reference };
  }

  const confirmedAt = input.confirmedAt ?? new Date();
  const due = formatTime(mariaDepositDeadline(confirmedAt), input.timeZone);
  const qrUrl = new URL(mariaSwishQrPath(input.bookingId), origin).toString();
  const paymentPageUrl = new URL(mariaSwishPaymentPagePath(input.bookingId), origin).toString();
  const payment = MARIA_DEPOSIT_AMOUNT_SEK.toLocaleString("sv-SE");
  const text = [
    `Hej ${input.customerName},`, "",
    `Maria har bekräftat din bokning hos ${input.companyName}.`,
    `Tjänst: ${input.service}`,
    `Tid: ${start} – ${end}`,
    `Bokningsnummer: ${reference}`, "",
    "Endast Preview-test: gör ingen riktig Swish-betalning.",
    `Handpenning: ${payment} kr via Swish.`,
    `Betala inom 24 timmar från bekräftelsen, senast ${due}.`,
    `Swish företag: ${MARIA_SWISH_NUMBER}`,
    `Visa betalningsuppgifter: ${paymentPageUrl}`,
    `QR-kod: ${qrUrl}`,
    `Skriv exakt detta bokningsnummer i Swish-fältet Meddelande: ${reference}`, "",
    "QR-koden fyller i mottagare, 2 000 kr och bokningsnumret. Kontrollera alltid mottagaren i Swish innan du signerar. Ingen automatisk betalningsverifiering sker.",
    "Om handpenningen inte har registrerats inom 24 timmar kan Maria avboka bokningen manuellt. Avbokning sker inte automatiskt.",
    "", "Vänliga hälsningar", input.companyName,
  ].join("\n");
  const html = `<div lang="sv" style="max-width:640px;margin:0 auto;font:16px/1.6 Arial,sans-serif;color:#432a35">
    <div style="background:#fcfaf8;border:1px solid #ead9df;padding:25px;border-radius:12px">
      ${logo}
      <h1 style="color:#845363;margin-top:0">Din bokning är bekräftad</h1>
      <p>Hej ${escapeHtml(input.customerName)},</p>
      <p>Maria har bekräftat din bokning hos <strong>${escapeHtml(input.companyName)}</strong>.</p>
      <p><strong>Tjänst:</strong> ${escapeHtml(input.service)}<br/>
      <strong>Tid:</strong> ${escapeHtml(start)} – ${escapeHtml(end)}<br/>
      <strong>Bokningsnummer:</strong> <code>${escapeHtml(reference)}</code></p>
      <p style="font-size:14px;color:#8b2d39;font-weight:bold">Endast Preview-test – gör ingen riktig Swish-betalning.</p>
      <h2 style="color:#845363;font-size:21px">Handpenning: ${payment} kr</h2>
      <p><strong>Betala via Swish inom 24 timmar, senast ${escapeHtml(due)}.</strong></p>
      <p><strong>Swish företag:</strong> ${escapeHtml(MARIA_SWISH_NUMBER)}</p>
      <p><img src="${escapeHtml(qrUrl)}" alt="Swish QR-kod med 2 000 kr och bokningsnummer för Makeup by Maria" width="380"
        style="display:block;max-width:100%;height:auto;border-radius:10px" /></p>
      <p><a href="${escapeHtml(paymentPageUrl)}" style="color:#845363;font-weight:bold">
        Visa Swish-uppgifter och öppna Swish</a></p>
      <p style="font-size:13px">Sidan visar en direkt Swish-knapp, QR-kod och kopierbara betalningsuppgifter.
      Om appen bara visar startsidan kan du använda QR-koden på en annan skärm eller kopiera uppgifterna.</p>
      <p><strong>Meddelande i Swish:</strong><br/><code style="font-size:15px;overflow-wrap:anywhere">${escapeHtml(reference)}</code></p>
      <p style="font-size:13px;background:#f5e9eb;padding:12px">
        QR-koden fyller i mottagare, <strong>2 000 kr</strong> och
        bokningsnumret. Kontrollera mottagaren i Swish innan du signerar.
        Ingen automatisk betalningsverifiering sker.
      </p>
      <p style="font-size:13px">Om handpenningen inte registreras inom 24 timmar kan Maria
      avboka bokningen manuellt. Ingen automatisk avbokning sker.</p>
    </div>
    <p>Vänliga hälsningar<br/>${escapeHtml(input.companyName)}</p>
  </div>`;
  return { subject, text, html, reference };
}

/**
 * Only an explicitly allowed Preview QA inbox may receive a Swish/deposit email.
 * This does not initiate a transaction, validate payments or send SMS.
 */
export async function sendMariaBookingStatusEmail(input: MariaBookingStatusEmailInput) {
  const base = getMariaPreviewPortalBase();
  if (!base || !isMariaPreviewTestRecipient(input.customerEmail)) {
    return { ok: false as const, error: "preview_recipient_not_approved" as const };
  }
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false as const, error: "email_not_configured" as const };
  let content: ReturnType<typeof buildMariaBookingStatusEmail>;
  try {
    content = buildMariaBookingStatusEmail(input, base);
  } catch {
    return { ok: false as const, error: "invalid_booking" as const };
  }
  const senderParts = from.match(/^(.+?)\s*<([^>]+)>$/);
  const sender = senderParts
    ? { name: senderParts[1].trim(), email: senderParts[2].trim() }
    : { name: input.companyName, email: from.trim() };
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      signal: AbortSignal.timeout(10_000),
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender, to: [{ email: input.customerEmail, name: input.customerName }],
        subject: content.subject, textContent: content.text, htmlContent: content.html,
      }),
    });
    if (!response.ok) return { ok: false as const, error: "email_provider_rejected" as const };
    return { ok: true as const };
  } catch {
    return { ok: false as const, error: "email_delivery_uncertain" as const };
  }
}
