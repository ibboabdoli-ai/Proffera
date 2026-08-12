import type { WorkspaceTimeZone } from "@/lib/workspace-market";
import { primeViewSite } from "@/lib/primeview-seo";
import { sendBookingStatusEmail as sendDefaultBookingStatusEmail } from "./lead-email";

export * from "./lead-email";

type SendBookingStatusEmailInput = {
  customerName: string;
  customerEmail: string;
  companyName: string;
  status: "confirmed" | "cancelled";
  service: string;
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

function isPrimeViewCompany(companyName: string) {
  const normalized = companyName.trim().toLowerCase().replace(/\s+/g, " ");
  return normalized === "primeview" || normalized === "primeview window care";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseSenderEmail(value: string) {
  const match = value.match(/^(.+?)\s*<([^>]+)>$/);
  return (match?.[2] ?? value).trim();
}

function formatPrimeViewTime(value: string, timeZone: WorkspaceTimeZone = "Europe/London") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

function buildPrimeViewBookingStatusEmail(input: SendBookingStatusEmailInput) {
  const isConfirmed = input.status === "confirmed";
  const start = formatPrimeViewTime(input.startsAt, input.timeZone ?? "Europe/London");
  const end = formatPrimeViewTime(input.endsAt, input.timeZone ?? "Europe/London");
  const subject = isConfirmed
    ? "Booking confirmed – PrimeView Window Care"
    : "Booking cancelled – PrimeView Window Care";
  const headline = isConfirmed ? "Your booking is confirmed" : "Your booking has been cancelled";
  const intro = isConfirmed
    ? "Your PrimeView Window Care booking is confirmed. We look forward to taking care of your property."
    : "Your PrimeView Window Care booking has been cancelled. If you would like another appointment, you can book again online or contact us directly.";
  const nextStep = isConfirmed
    ? "Need to change anything? Contact PrimeView as soon as possible and we will help you."
    : "Want to choose a new time? Use the booking page or contact PrimeView directly.";

  const text = [
    `Hello ${input.customerName},`,
    "",
    intro,
    "",
    `Service: ${input.service}`,
    `Start: ${start}`,
    `End: ${end}`,
    input.city ? `Area: ${input.city}` : "",
    "",
    nextStep,
    "",
    `Book online: ${primeViewSite.origin}/booking`,
    `Phone: ${primeViewSite.telephoneDisplay}`,
    `Email: ${primeViewSite.email}`,
    "",
    "Kind regards,",
    "PrimeView Window Care",
  ].filter(Boolean).join("\n");

  const statusBackground = isConfirmed ? "#e8f5eb" : "#fff1f1";
  const statusColour = isConfirmed ? "#17452f" : "#9b1c1c";
  const statusLabel = isConfirmed ? "CONFIRMED" : "CANCELLED";

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#eef3fc;font-family:Arial,Helvetica,sans-serif;color:#09183a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#eef3fc;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 14px 36px rgba(6,24,59,.12);">
            <tr>
              <td style="background:#06183b;padding:24px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${escapeHtml(primeViewSite.logoUrl)}" width="64" height="60" alt="PrimeView Window Care" style="display:block;border:0;border-radius:12px;object-fit:cover;" />
                    </td>
                    <td align="right" style="vertical-align:middle;color:#ffffff;font-size:14px;font-weight:700;">PrimeView Window Care</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 8px;">
                <span style="display:inline-block;border-radius:999px;background:${statusBackground};color:${statusColour};padding:8px 12px;font-size:12px;font-weight:800;letter-spacing:.08em;">${statusLabel}</span>
                <h1 style="margin:18px 0 10px;font-size:30px;line-height:1.15;color:#071b42;">${headline}</h1>
                <p style="margin:0;color:#52647c;font-size:16px;line-height:1.7;">Hello ${escapeHtml(input.customerName)},</p>
                <p style="margin:12px 0 0;color:#52647c;font-size:16px;line-height:1.7;">${escapeHtml(intro)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border:1px solid #d7e1f2;border-radius:16px;background:#f8fbff;">
                  <tr><td style="padding:16px 18px 8px;font-size:12px;font-weight:800;color:#315997;text-transform:uppercase;letter-spacing:.08em;">Booking details</td></tr>
                  <tr><td style="padding:6px 18px;color:#071b42;font-size:15px;"><strong>Service:</strong> ${escapeHtml(input.service)}</td></tr>
                  <tr><td style="padding:6px 18px;color:#071b42;font-size:15px;"><strong>Start:</strong> ${escapeHtml(start)}</td></tr>
                  <tr><td style="padding:6px 18px;color:#071b42;font-size:15px;"><strong>End:</strong> ${escapeHtml(end)}</td></tr>
                  ${input.city ? `<tr><td style="padding:6px 18px 16px;color:#071b42;font-size:15px;"><strong>Area:</strong> ${escapeHtml(input.city)}</td></tr>` : `<tr><td style="padding:6px 18px 16px;"></td></tr>`}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 28px 30px;">
                <p style="margin:0 0 18px;color:#52647c;font-size:15px;line-height:1.7;">${escapeHtml(nextStep)}</p>
                <a href="${escapeHtml(primeViewSite.origin)}/booking" style="display:inline-block;border-radius:12px;background:#0a3c8f;color:#ffffff;text-decoration:none;padding:14px 20px;font-size:14px;font-weight:800;">Open PrimeView booking</a>
                <p style="margin:24px 0 0;color:#52647c;font-size:13px;line-height:1.7;">Call <a href="tel:${escapeHtml(primeViewSite.telephone)}" style="color:#0a3c8f;font-weight:700;">${escapeHtml(primeViewSite.telephoneDisplay)}</a> · Email <a href="mailto:${escapeHtml(primeViewSite.email)}" style="color:#0a3c8f;font-weight:700;">${escapeHtml(primeViewSite.email)}</a></p>
              </td>
            </tr>
            <tr>
              <td style="background:#030f28;padding:18px 28px;color:#cbd5e1;font-size:12px;line-height:1.6;">PrimeView Window Care · Professional exterior cleaning across West &amp; North London.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

export async function sendBookingStatusEmail(input: SendBookingStatusEmailInput) {
  if (!isPrimeViewCompany(input.companyName)) {
    return sendDefaultBookingStatusEmail(input);
  }

  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false as const, message: "Brevo is not configured." };

  const email = buildPrimeViewBookingStatusEmail(input);
  const senderEmail = parseSenderEmail(from);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: { name: "PrimeView Window Care", email: senderEmail },
        to: [{ email: input.customerEmail, name: input.customerName }],
        replyTo: { email: primeViewSite.email, name: "PrimeView Window Care" },
        subject: email.subject,
        textContent: email.text,
        htmlContent: email.html,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as BrevoResponse;
    if (!response.ok) return { ok: false as const, message: data.message ?? data.code ?? "Could not send PrimeView booking status email." };
    return { ok: true as const, providerId: data.messageId ?? null };
  } catch {
    return { ok: false as const, message: "Could not contact Brevo." };
  }
}
