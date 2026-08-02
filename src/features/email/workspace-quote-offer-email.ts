import "server-only";

import { Buffer } from "node:buffer";

export type WorkspaceQuoteOfferEmailInput = {
  customerName: string;
  customerEmail: string;
  companyName: string;
  quoteReferenceId: string;
  title: string;
  currency: string;
  totalMinor: number;
  validUntil: string;
  offerUrl: string;
  pdfUrl: string;
  pdfFilename: string;
  pdfBytes: Uint8Array;
  locale: "sv" | "en";
};

export type WorkspaceQuoteOfferEmailDeliveryResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; code: "configuration" | "provider" | "network" };

type BrevoResponse = {
  messageId?: string;
  message?: string;
  code?: string;
};

const copy = {
  sv: {
    subject: (companyName: string) => `Din offert från ${companyName}`,
    greeting: "Hej",
    intro: "Din offert är klar att läsa och besvara online.",
    reference: "Referens",
    offer: "Offert",
    total: "Totalt",
    validUntil: "Giltig till",
    open: "Öppna offert",
    pdf: "Hämta PDF",
    attachment: "En PDF-kopia av offerten finns också bifogad.",
    safety: "Länken är personlig. Dela den inte med någon annan.",
    closing: "Med vänliga hälsningar",
    unavailableDate: "Ej angivet",
  },
  en: {
    subject: (companyName: string) => `Your quote from ${companyName}`,
    greeting: "Hello",
    intro: "Your quote is ready to review and respond to online.",
    reference: "Reference",
    offer: "Quote",
    total: "Total",
    validUntil: "Valid until",
    open: "Open quote",
    pdf: "Download PDF",
    attachment: "A PDF copy of the quote is also attached.",
    safety: "This is a personal link. Do not share it with anyone else.",
    closing: "Kind regards",
    unavailableDate: "Not specified",
  },
} as const;

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
  return match
    ? { name: match[1].trim(), email: match[2].trim() }
    : { name: "Proffera", email: value.trim() };
}

function formatMoney(amountMinor: number, currency: string, locale: WorkspaceQuoteOfferEmailInput["locale"]) {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "sv-SE", {
    style: "currency",
    currency,
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100);
}

function formatDate(value: string, locale: WorkspaceQuoteOfferEmailInput["locale"], fallback: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "sv-SE", { dateStyle: "long" }).format(date);
}

export function buildWorkspaceQuoteOfferEmail(input: WorkspaceQuoteOfferEmailInput) {
  const text = copy[input.locale];
  const total = formatMoney(input.totalMinor, input.currency, input.locale);
  const validUntil = formatDate(input.validUntil, input.locale, text.unavailableDate);
  const subject = text.subject(input.companyName);
  const plainText = [
    `${text.greeting} ${input.customerName},`,
    "",
    text.intro,
    "",
    `${text.reference}: ${input.quoteReferenceId}`,
    `${text.offer}: ${input.title}`,
    `${text.total}: ${total}`,
    `${text.validUntil}: ${validUntil}`,
    "",
    `${text.open}: ${input.offerUrl}`,
    `${text.pdf}: ${input.pdfUrl}`,
    "",
    text.attachment,
    text.safety,
    "",
    `${text.closing},`,
    input.companyName,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;max-width:640px;">
      <p>${escapeHtml(text.greeting)} ${escapeHtml(input.customerName)},</p>
      <p>${escapeHtml(text.intro)}</p>
      <table style="border-collapse:collapse;width:100%;max-width:560px;margin:20px 0;">
        <tr><td style="padding:8px 18px 8px 0;font-weight:700;vertical-align:top;">${escapeHtml(text.reference)}</td><td style="padding:8px 0;">${escapeHtml(input.quoteReferenceId)}</td></tr>
        <tr><td style="padding:8px 18px 8px 0;font-weight:700;vertical-align:top;">${escapeHtml(text.offer)}</td><td style="padding:8px 0;">${escapeHtml(input.title)}</td></tr>
        <tr><td style="padding:8px 18px 8px 0;font-weight:700;vertical-align:top;">${escapeHtml(text.total)}</td><td style="padding:8px 0;">${escapeHtml(total)}</td></tr>
        <tr><td style="padding:8px 18px 8px 0;font-weight:700;vertical-align:top;">${escapeHtml(text.validUntil)}</td><td style="padding:8px 0;">${escapeHtml(validUntil)}</td></tr>
      </table>
      <p style="margin:28px 0 14px;"><a href="${escapeHtml(input.offerUrl)}" style="display:inline-block;border-radius:12px;background:#17452f;color:#ffffff;padding:14px 22px;text-decoration:none;font-weight:700;">${escapeHtml(text.open)}</a></p>
      <p><a href="${escapeHtml(input.pdfUrl)}" style="color:#17452f;font-weight:700;">${escapeHtml(text.pdf)}</a></p>
      <p>${escapeHtml(text.attachment)}</p>
      <p style="font-size:13px;color:#5b665f;">${escapeHtml(text.safety)}</p>
      <p>${escapeHtml(text.closing)},<br />${escapeHtml(input.companyName)}</p>
    </div>
  `;

  return { subject, text: plainText, html };
}

export async function sendWorkspaceQuoteOfferEmail(
  input: WorkspaceQuoteOfferEmailInput,
): Promise<WorkspaceQuoteOfferEmailDeliveryResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false, code: "configuration" };

  const email = buildWorkspaceQuoteOfferEmail(input);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: parseSender(from),
        to: [{ email: input.customerEmail, name: input.customerName }],
        subject: email.subject,
        textContent: email.text,
        htmlContent: email.html,
        tags: ["workspace-quote-offer"],
        attachment: [{
          name: input.pdfFilename,
          content: Buffer.from(input.pdfBytes).toString("base64"),
        }],
      }),
    });
    const data = (await response.json().catch(() => ({}))) as BrevoResponse;
    if (!response.ok) return { ok: false, code: "provider" };
    return { ok: true, providerMessageId: data.messageId ?? null };
  } catch {
    return { ok: false, code: "network" };
  }
}
