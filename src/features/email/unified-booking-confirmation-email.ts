import "server-only";

import type { WorkspaceTimeZone } from "@/lib/workspace-market";

type Input = {
  customerName: string;
  customerEmail: string;
  companyName: string;
  service: string;
  startsAt: string;
  endsAt: string;
  city: string;
  address?: string;
  postcode?: string;
  timeZone?: WorkspaceTimeZone;
  portalUrl: string;
  rescheduleUrl: string;
  language?: "sv" | "en";
};

type BrevoResponse = {
  messageId?: string;
  message?: string;
  code?: string;
};

const primeViewLogo = "https://www.primeviewwindowcare.co.uk/brand/primeview-window-care-logo.jpeg";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseSender(value: string) {
  const match = value.match(/^(.+?)\s*<([^>]+)>$/);
  if (!match) return { name: "Proffera", email: value.trim() };
  return { name: match[1].trim(), email: match[2].trim() };
}

function formatBookingTime(value: string, timeZone: WorkspaceTimeZone = "Europe/Stockholm", language: "sv" | "en" = "sv") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "sv-SE", {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

export function buildUnifiedBookingConfirmationEmail(input: Input) {
  const language = input.language ?? (input.companyName.trim().toLowerCase() === "primeview window care" ? "en" : "sv");
  const isEnglish = language === "en";
  const start = formatBookingTime(input.startsAt, input.timeZone, language);
  const end = formatBookingTime(input.endsAt, input.timeZone, language);
  const subject = isEnglish
    ? `Booking request received – ${input.companyName}`
    : `Bokningsförfrågan mottagen – ${input.companyName}`;

  const text = isEnglish
    ? [
        `Hello ${input.customerName},`,
        "",
        `We have received your booking request with ${input.companyName}.`,
        "",
        `Service: ${input.service}`,
        input.address ? `Address: ${input.address}` : "",
        input.postcode ? `Postcode: ${input.postcode}` : "",
        `Start: ${start}`,
        `End: ${end}`,
        input.city ? `Area: ${input.city}` : "",
        "",
        "The company will confirm the appointment separately.",
        "You can view, reschedule or cancel the booking from your private booking page:",
        input.portalUrl,
        "",
        "Reschedule directly:",
        input.rescheduleUrl,
        "",
        "These links are personal. Please do not share them with anyone else.",
        "",
        "Kind regards",
        input.companyName,
        "Powered by Proffera",
      ].filter(Boolean).join("\n")
    : [
        `Hej ${input.customerName},`,
        "",
        `Vi har tagit emot din bokningsförfrågan hos ${input.companyName}.`,
        "",
        `Tjänst: ${input.service}`,
        input.address ? `Adress: ${input.address}` : "",
        input.postcode ? `Postnummer: ${input.postcode}` : "",
        `Start: ${start}`,
        `Slut: ${end}`,
        input.city ? `Ort: ${input.city}` : "",
        "",
        "Företaget bekräftar tiden separat.",
        "Du kan se, boka om eller avboka bokningen via din privata bokningssida:",
        input.portalUrl,
        "",
        "Boka om direkt:",
        input.rescheduleUrl,
        "",
        "Länkarna är personliga. Dela dem inte med andra.",
        "",
        "Med vänliga hälsningar",
        input.companyName,
        "Powered by Proffera",
      ].filter(Boolean).join("\n");

  const html = isEnglish ? `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0b2a4a;max-width:640px;margin:0 auto;">
      <div style="border:1px solid #d9e4ef;border-radius:20px;overflow:hidden;background:#ffffff;box-shadow:0 10px 30px rgba(11,42,74,.08);">
        <div style="background:#06183b;color:#ffffff;padding:22px 28px;">
          <table role="presentation" style="width:100%;border-collapse:collapse;"><tr>
            <td style="width:58px;vertical-align:middle;"><img src="${primeViewLogo}" width="48" height="48" alt="PrimeView Window Care" style="display:block;width:48px;height:48px;border-radius:11px;object-fit:cover;border:1px solid rgba(255,255,255,.25);" /></td>
            <td style="vertical-align:middle;"><p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#b8ceff;">Booking request</p><h1 style="margin:5px 0 0;font-size:24px;line-height:1.25;color:#ffffff;">${escapeHtml(input.companyName)}</h1></td>
          </tr></table>
        </div>
        <div style="padding:26px 28px;">
          <p>Hello ${escapeHtml(input.customerName)},</p>
          <p>We have received your booking request. PrimeView will confirm the appointment separately.</p>
          <table role="presentation" style="width:100%;border-collapse:collapse;margin:22px 0;background:#f4f7fb;border-radius:14px;">
            <tr><td style="padding:14px 16px 6px;font-weight:700;width:110px;color:#183e63;">Service</td><td style="padding:14px 16px 6px;">${escapeHtml(input.service)}</td></tr>
            ${input.address ? `<tr><td style="padding:6px 16px;font-weight:700;color:#183e63;">Address</td><td style="padding:6px 16px;">${escapeHtml(input.address)}</td></tr>` : ""}
            ${input.postcode ? `<tr><td style="padding:6px 16px;font-weight:700;color:#183e63;">Postcode</td><td style="padding:6px 16px;">${escapeHtml(input.postcode)}</td></tr>` : ""}
            <tr><td style="padding:6px 16px;font-weight:700;color:#183e63;">Start</td><td style="padding:6px 16px;">${escapeHtml(start)}</td></tr>
            <tr><td style="padding:6px 16px;font-weight:700;color:#183e63;">End</td><td style="padding:6px 16px;">${escapeHtml(end)}</td></tr>
            ${input.city ? `<tr><td style="padding:6px 16px 14px;font-weight:700;color:#183e63;">Area</td><td style="padding:6px 16px 14px;">${escapeHtml(input.city)}</td></tr>` : ""}
          </table>
          <h2 style="font-size:19px;margin:26px 0 8px;color:#071b42;">Manage your booking</h2>
          <p style="margin-top:0;color:#5d7187;">You can view, reschedule or cancel your booking without creating an account.</p>
          <p style="margin:22px 0 12px;">
            <a href="${escapeHtml(input.portalUrl)}" style="display:inline-block;background:#0a3c8f;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:12px;">Manage booking</a>
          </p>
          <p style="margin:0 0 22px;">
            <a href="${escapeHtml(input.rescheduleUrl)}" style="display:inline-block;border:1px solid #0a3c8f;color:#0a3c8f;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;margin-right:8px;margin-bottom:8px;">Reschedule</a>
            <a href="${escapeHtml(input.portalUrl)}" style="display:inline-block;border:1px solid #d9aaa3;color:#9d3429;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;margin-bottom:8px;">Cancel or view terms</a>
          </p>
          <p style="font-size:13px;color:#667b91;">These links are personal and should not be shared with anyone else.</p>
          <p style="margin-top:26px;">Kind regards<br /><strong>${escapeHtml(input.companyName)}</strong></p>
        </div>
      </div>
      <p style="text-align:center;font-size:12px;color:#8a98aa;margin-top:14px;">PrimeView Window Care · Powered by Proffera</p>
    </div>
  ` : `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;max-width:640px;margin:0 auto;">
      <div style="border:1px solid #dfe6df;border-radius:20px;overflow:hidden;background:#ffffff;">
        <div style="background:#173e2b;color:#ffffff;padding:24px 28px;">
          <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#dce9df;">Bokningsförfrågan</p>
          <h1 style="margin:8px 0 0;font-size:25px;line-height:1.25;">${escapeHtml(input.companyName)}</h1>
        </div>
        <div style="padding:26px 28px;">
          <p>Hej ${escapeHtml(input.customerName)},</p>
          <p>Vi har tagit emot din bokningsförfrågan. Företaget bekräftar tiden separat.</p>
          <table role="presentation" style="width:100%;border-collapse:collapse;margin:22px 0;background:#f4f7f3;border-radius:14px;">
            <tr><td style="padding:14px 16px 6px;font-weight:700;width:110px;">Tjänst</td><td style="padding:14px 16px 6px;">${escapeHtml(input.service)}</td></tr>
            ${input.address ? `<tr><td style="padding:6px 16px;font-weight:700;">Adress</td><td style="padding:6px 16px;">${escapeHtml(input.address)}</td></tr>` : ""}
            ${input.postcode ? `<tr><td style="padding:6px 16px;font-weight:700;">Postnummer</td><td style="padding:6px 16px;">${escapeHtml(input.postcode)}</td></tr>` : ""}
            <tr><td style="padding:6px 16px;font-weight:700;">Start</td><td style="padding:6px 16px;">${escapeHtml(start)}</td></tr>
            <tr><td style="padding:6px 16px;font-weight:700;">Slut</td><td style="padding:6px 16px;">${escapeHtml(end)}</td></tr>
            ${input.city ? `<tr><td style="padding:6px 16px 14px;font-weight:700;">Ort</td><td style="padding:6px 16px 14px;">${escapeHtml(input.city)}</td></tr>` : ""}
          </table>
          <h2 style="font-size:19px;margin:26px 0 8px;">Hantera din bokning</h2>
          <p style="margin-top:0;color:#526158;">Du kan se, boka om eller avboka bokningen utan att skapa ett konto.</p>
          <p style="margin:22px 0 12px;">
            <a href="${escapeHtml(input.portalUrl)}" style="display:inline-block;background:#17452f;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:12px;">Hantera bokning</a>
          </p>
          <p style="margin:0 0 22px;">
            <a href="${escapeHtml(input.rescheduleUrl)}" style="display:inline-block;border:1px solid #17452f;color:#17452f;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;margin-right:8px;margin-bottom:8px;">Boka om</a>
            <a href="${escapeHtml(input.portalUrl)}" style="display:inline-block;border:1px solid #d9aaa3;color:#9d3429;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;margin-bottom:8px;">Avboka eller se villkor</a>
          </p>
          <p style="font-size:13px;color:#667168;">Länkarna är personliga och ska inte delas med andra.</p>
          <p style="margin-top:26px;">Med vänliga hälsningar<br /><strong>${escapeHtml(input.companyName)}</strong></p>
        </div>
      </div>
      <p style="text-align:center;font-size:12px;color:#8a938d;margin-top:14px;">Powered by Proffera</p>
    </div>
  `;

  return { subject, text, html };
}

export async function sendUnifiedBookingConfirmationEmail(input: Input) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false as const, message: "Brevo är inte konfigurerat." };

  const sender = parseSender(from);
  const email = buildUnifiedBookingConfirmationEmail(input);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender,
        to: [{ email: input.customerEmail, name: input.customerName }],
        subject: email.subject,
        textContent: email.text,
        htmlContent: email.html,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as BrevoResponse;
    if (!response.ok) {
      return { ok: false as const, message: data.message ?? data.code ?? "Kunde inte skicka bokningsbekräftelse." };
    }
    return { ok: true as const, providerId: data.messageId ?? null };
  } catch {
    return { ok: false as const, message: "Kunde inte kontakta Brevo." };
  }
}
