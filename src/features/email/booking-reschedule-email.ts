import type { WorkspaceTimeZone } from "@/lib/workspace-market";
import { bookingDateLocale } from "@/lib/booking-date-locale";
import { resolveBrevoApiKey } from "@/lib/email-runtime-config";
import { mariaEmailLogoHtml } from "@/lib/maria-email-logo";
import { getMariaBookingPortalBase, isMariaBookingRecipientAllowed } from "@/lib/maria-preview-customer-safety";
import { getMariaBookingReadiness } from "@/lib/maria-booking-runtime";

type SendBookingRescheduleEmailInput = {
  customerName: string;
  customerEmail: string;
  companyName: string;
  branding?: "makeup-by-maria";
  service: string;
  previousStartsAt: string;
  startsAt: string;
  endsAt: string;
  city: string;
  timeZone?: WorkspaceTimeZone;
  language?: "sv" | "en" | "ar";
};

type BrevoResponse = {
  messageId?: string;
  message?: string;
  code?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseSender(value: string) {
  const match = value.trim().match(/^(.+?)\s*<([^>]+)>$/);
  if (!match) return { name: "Proffera", email: value.trim() };
  return { name: match[1].trim(), email: match[2].trim() };
}

function formatBookingDate(value: string, timeZone: WorkspaceTimeZone = "Europe/Stockholm", language: "sv" | "en" | "ar" = "sv") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(bookingDateLocale(language), {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

export async function sendBookingRescheduleEmail(input: SendBookingRescheduleEmailInput) {
  if (input.branding === "makeup-by-maria") {
    if (!getMariaBookingPortalBase() || !isMariaBookingRecipientAllowed(input.customerEmail)) {
      return { ok: false as const, message: "Maria booking recipient is not allowed." };
    }
    if (process.env.VERCEL_ENV === "production" && !(await getMariaBookingReadiness()).enabled) {
      return { ok: false as const, message: "Maria booking is not ready." };
    }
  }
  const apiKey = resolveBrevoApiKey();
  const from = process.env.LEAD_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false as const, message: "Brevo är inte konfigurerat." };

  const logo = input.branding === "makeup-by-maria"
    ? mariaEmailLogoHtml(getMariaBookingPortalBase()) : "";
  const language = input.branding === "makeup-by-maria" && (input.language === "en" || input.language === "ar")
    ? input.language : "sv";
  const previousStart = formatBookingDate(input.previousStartsAt, input.timeZone, language);
  const start = formatBookingDate(input.startsAt, input.timeZone, language);
  const end = formatBookingDate(input.endsAt, input.timeZone, language);
  const copy = language === "en" ? {
    title: "Your booking has been rescheduled", greeting: "Hello", intro: "Your booking with",
    changed: "has a new appointment time", previous: "Previous start", next: "New start",
    end: "New end", service: "Service", location: "Location",
    note: "Please contact the company if the new time does not suit you.", signature: "Kind regards",
  } : language === "ar" ? {
    title: "تم تغيير موعد حجزك", greeting: "مرحبًا", intro: "تم تغيير موعد حجزك لدى",
    changed: "", previous: "الموعد السابق", next: "الموعد الجديد",
    end: "نهاية الموعد الجديد", service: "الخدمة", location: "المدينة",
    note: "تواصلي مع الشركة إذا لم يناسبك الموعد الجديد.", signature: "مع أطيب التحيات",
  } : null;
  const subject = copy ? `${copy.title} – ${input.companyName}` : `Din bokning har flyttats – ${input.companyName}`;
  const text = copy ? [
    `${copy.greeting} ${input.customerName},`, "",
    `${copy.intro} ${input.companyName} ${copy.changed}`.trim(), "",
    `${copy.previous}: ${previousStart}`, `${copy.next}: ${start}`,
    `${copy.end}: ${end}`, `${copy.service}: ${input.service}`,
    input.city ? `${copy.location}: ${input.city}` : "", "",
    copy.note, "", copy.signature, input.companyName,
  ].filter(Boolean).join("\n") : [
    `Hej ${input.customerName},`,
    "",
    `Din bokning hos ${input.companyName} har fått en ny tid.`,
    "",
    `Tidigare start: ${previousStart}`,
    `Ny start: ${start}`,
    `Ny sluttid: ${end}`,
    `Tjänst: ${input.service}`,
    input.city ? `Ort: ${input.city}` : "",
    "",
    "Kontakta företaget om den nya tiden inte passar.",
    "",
    "Med vänliga hälsningar",
    input.companyName,
  ].filter(Boolean).join("\n");
  const html = copy ? `<div lang="${language}" dir="${language === "ar" ? "rtl" : "ltr"}" style="font-family:Arial,sans-serif;line-height:1.7;color:#352a2c;max-width:640px;margin:0 auto">
    ${logo}<h2>${escapeHtml(copy.title)}</h2>
    <p>${escapeHtml(copy.greeting)} ${escapeHtml(input.customerName)},</p>
    <p>${escapeHtml(copy.intro)} <strong>${escapeHtml(input.companyName)}</strong> ${escapeHtml(copy.changed)}</p>
    <ul><li><strong>${escapeHtml(copy.previous)}:</strong> ${escapeHtml(previousStart)}</li>
    <li><strong>${escapeHtml(copy.next)}:</strong> ${escapeHtml(start)}</li>
    <li><strong>${escapeHtml(copy.end)}:</strong> ${escapeHtml(end)}</li>
    <li><strong>${escapeHtml(copy.service)}:</strong> ${escapeHtml(input.service)}</li>
    ${input.city ? `<li><strong>${escapeHtml(copy.location)}:</strong> ${escapeHtml(input.city)}</li>` : ""}</ul>
    <p>${escapeHtml(copy.note)}</p><p>${escapeHtml(copy.signature)}<br>${escapeHtml(input.companyName)}</p></div>` : `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;">
      ${logo}
      <p>Hej ${escapeHtml(input.customerName)},</p>
      <p>Din bokning hos <strong>${escapeHtml(input.companyName)}</strong> har fått en ny tid.</p>
      <ul>
        <li><strong>Tidigare start:</strong> ${escapeHtml(previousStart)}</li>
        <li><strong>Ny start:</strong> ${escapeHtml(start)}</li>
        <li><strong>Ny sluttid:</strong> ${escapeHtml(end)}</li>
        <li><strong>Tjänst:</strong> ${escapeHtml(input.service)}</li>
        ${input.city ? `<li><strong>Ort:</strong> ${escapeHtml(input.city)}</li>` : ""}
      </ul>
      <p>Kontakta företaget om den nya tiden inte passar.</p>
      <p>Med vänliga hälsningar<br />${escapeHtml(input.companyName)}</p>
    </div>
  `;

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      signal: AbortSignal.timeout(8_000),
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: parseSender(from),
        to: [{ email: input.customerEmail, name: input.customerName }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as BrevoResponse;
    if (!response.ok) return { ok: false as const, message: data.message ?? data.code ?? "Kunde inte skicka ombokningsmejl." };
    return { ok: true as const, providerId: data.messageId ?? null };
  } catch {
    return { ok: false as const, message: "Kunde inte kontakta Brevo." };
  }
}
