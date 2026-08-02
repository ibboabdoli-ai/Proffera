import type { WorkspaceTimeZone } from "@/lib/workspace-market";

type SendBookingRescheduleEmailInput = {
  customerName: string;
  customerEmail: string;
  companyName: string;
  service: string;
  previousStartsAt: string;
  startsAt: string;
  endsAt: string;
  city: string;
  timeZone?: WorkspaceTimeZone;
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
  const match = value.match(/^(.+?)\s*<([^>]+)>$/);
  if (!match) return { name: "Proffera", email: value.trim() };
  return { name: match[1].trim(), email: match[2].trim() };
}

function formatBookingDate(value: string, timeZone: WorkspaceTimeZone = "Europe/Stockholm") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

export async function sendBookingRescheduleEmail(input: SendBookingRescheduleEmailInput) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false as const, message: "Brevo är inte konfigurerat." };

  const previousStart = formatBookingDate(input.previousStartsAt, input.timeZone);
  const start = formatBookingDate(input.startsAt, input.timeZone);
  const end = formatBookingDate(input.endsAt, input.timeZone);
  const subject = `Din bokning har flyttats – ${input.companyName}`;
  const text = [
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
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;">
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
