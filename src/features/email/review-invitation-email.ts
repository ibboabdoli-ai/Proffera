import {
  resolveBrevoApiKey,
  resolveEmailRecipient,
} from "@/lib/email-runtime-config";
import { primeViewSite } from "@/lib/primeview-seo";

export type ReviewInvitationEmailLanguage = "sv" | "en";

export type SendVerifiedReviewInvitationEmailInput = {
  customerName: string;
  customerEmail: string;
  companyName: string;
  bookingTitle: string;
  reviewUrl: string;
  expiresAt: string;
  language?: ReviewInvitationEmailLanguage;
  timeZone?: string;
};

type BrevoResponse = {
  messageId?: string;
  message?: string;
  code?: string;
};

export type VerifiedReviewInvitationEmailResult =
  | { ok: true; providerId: string | null }
  | {
      ok: false;
      code: "configuration" | "provider" | "network";
      message: string;
    };

const PRIMEVIEW_GOOGLE_REVIEWS_URL =
  "https://www.google.com/maps/place/PrimeView+Window+Care/@51.5665682,-0.4737333,11z/data=!4m8!3m7!1s0x893cb4b7e3dcc37b:0x47fd0c4bc2acaa07!8m2!3d51.5664702!4d-0.308927!9m1!1b1!16s%2Fg%2F11zh9kb89p";

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

function parseSender(value: string) {
  const match = value.match(/^(.+?)\s*<([^>]+)>$/);
  if (!match) {
    return { name: "Proffera", email: value.trim() };
  }

  return {
    name: match[1].trim(),
    email: match[2].trim(),
  };
}

function formatExpiry(value: string, language: ReviewInvitationEmailLanguage, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  try {
    return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "sv-SE", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function buildPrimeViewReviewInvitationEmail(input: SendVerifiedReviewInvitationEmailInput) {
  const expiresAt = formatExpiry(input.expiresAt, "en", "Europe/London");
  const subject = "How did we do? Leave a review – PrimeView Window Care";
  const text = [
    `Hello ${input.customerName},`,
    "",
    "Thank you for choosing PrimeView Window Care.",
    `Your completed service: ${input.bookingTitle}`,
    "",
    "We would really appreciate your feedback.",
    "",
    "Leave a Google review:",
    PRIMEVIEW_GOOGLE_REVIEWS_URL,
    "",
    "Or leave a verified review on the PrimeView website:",
    input.reviewUrl,
    "",
    `Your secure PrimeView website review link can be used once and expires on ${expiresAt}.`,
    "",
    `Phone: ${primeViewSite.telephoneDisplay}`,
    `Email: ${primeViewSite.email}`,
    "",
    "Kind regards,",
    "PrimeView Window Care",
  ].join("\n");

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
                <span style="display:inline-block;border-radius:999px;background:#fff6dd;color:#8a5b00;padding:8px 12px;font-size:12px;font-weight:800;letter-spacing:.08em;">YOUR FEEDBACK</span>
                <h1 style="margin:18px 0 10px;font-size:30px;line-height:1.15;color:#071b42;">How did we do?</h1>
                <p style="margin:0;color:#52647c;font-size:16px;line-height:1.7;">Hello ${escapeHtml(input.customerName)},</p>
                <p style="margin:12px 0 0;color:#52647c;font-size:16px;line-height:1.7;">Thank you for choosing PrimeView Window Care. We would really appreciate a quick review of your experience.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border:1px solid #d7e1f2;border-radius:16px;background:#f8fbff;">
                  <tr><td style="padding:16px 18px 8px;font-size:12px;font-weight:800;color:#315997;text-transform:uppercase;letter-spacing:.08em;">Completed service</td></tr>
                  <tr><td style="padding:6px 18px 16px;color:#071b42;font-size:16px;font-weight:700;">${escapeHtml(input.bookingTitle)}</td></tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 28px 30px;">
                <p style="margin:0 0 12px;color:#071b42;font-size:17px;font-weight:800;">Review PrimeView on Google</p>
                <p style="margin:0 0 18px;color:#52647c;font-size:14px;line-height:1.7;">Google reviews help local customers find and choose PrimeView Window Care.</p>
                <a href="${escapeHtml(PRIMEVIEW_GOOGLE_REVIEWS_URL)}" style="display:inline-block;border-radius:12px;background:#0a3c8f;color:#ffffff;text-decoration:none;padding:14px 20px;font-size:14px;font-weight:800;">Leave a Google review</a>

                <div style="height:1px;background:#e1e8f4;margin:28px 0;"></div>

                <p style="margin:0 0 12px;color:#071b42;font-size:17px;font-weight:800;">Leave a verified website review</p>
                <p style="margin:0 0 18px;color:#52647c;font-size:14px;line-height:1.7;">You can also leave a verified review directly on the PrimeView website using your secure one-time link.</p>
                <a href="${escapeHtml(input.reviewUrl)}" style="display:inline-block;border-radius:12px;border:2px solid #0a3c8f;background:#ffffff;color:#0a3c8f;text-decoration:none;padding:12px 18px;font-size:14px;font-weight:800;">Leave a verified review</a>
                <p style="margin:18px 0 0;color:#6a7890;font-size:12px;line-height:1.6;">The secure website review link can be used once and expires on ${escapeHtml(expiresAt)}.</p>
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

export function buildVerifiedReviewInvitationEmail(
  input: SendVerifiedReviewInvitationEmailInput,
) {
  if (isPrimeViewCompany(input.companyName)) {
    return buildPrimeViewReviewInvitationEmail(input);
  }

  const language = input.language === "en" ? "en" : "sv";
  const timeZone = input.timeZone || "Europe/Stockholm";
  const expiresAt = formatExpiry(input.expiresAt, language, timeZone);

  if (language === "en") {
    const subject = `How did we do? – ${input.companyName}`;
    const text = [
      `Hello ${input.customerName},`,
      "",
      `Thank you for choosing ${input.companyName}.`,
      `Your completed booking: ${input.bookingTitle}`,
      "",
      "Share your experience using your secure, one-time review link:",
      input.reviewUrl,
      "",
      `The link expires on ${expiresAt}.`,
      "",
      "Kind regards,",
      input.companyName,
    ].join("\n");
    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;">
        <p>Hello ${escapeHtml(input.customerName)},</p>
        <p>Thank you for choosing <strong>${escapeHtml(input.companyName)}</strong>.</p>
        <p>Your completed booking: <strong>${escapeHtml(input.bookingTitle)}</strong></p>
        <p style="margin:28px 0;">
          <a href="${escapeHtml(input.reviewUrl)}" style="display:inline-block;border-radius:12px;background:#173e2b;color:#fff;padding:14px 22px;text-decoration:none;font-weight:700;">Leave a verified review</a>
        </p>
        <p>This secure link can be used once and expires on ${escapeHtml(expiresAt)}.</p>
        <p>Kind regards<br />${escapeHtml(input.companyName)}</p>
      </div>
    `;
    return { subject, text, html };
  }

  const subject = `Hur gick det? – ${input.companyName}`;
  const text = [
    `Hej ${input.customerName},`,
    "",
    `Tack för att du valde ${input.companyName}.`,
    `Din slutförda bokning: ${input.bookingTitle}`,
    "",
    "Dela din upplevelse via din säkra engångslänk:",
    input.reviewUrl,
    "",
    `Länken gäller till ${expiresAt}.`,
    "",
    "Med vänliga hälsningar",
    input.companyName,
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;">
      <p>Hej ${escapeHtml(input.customerName)},</p>
      <p>Tack för att du valde <strong>${escapeHtml(input.companyName)}</strong>.</p>
      <p>Din slutförda bokning: <strong>${escapeHtml(input.bookingTitle)}</strong></p>
      <p style="margin:28px 0;">
        <a href="${escapeHtml(input.reviewUrl)}" style="display:inline-block;border-radius:12px;background:#173e2b;color:#fff;padding:14px 22px;text-decoration:none;font-weight:700;">Lämna ett verifierat omdöme</a>
      </p>
      <p>Den säkra länken kan användas en gång och gäller till ${escapeHtml(expiresAt)}.</p>
      <p>Med vänliga hälsningar<br />${escapeHtml(input.companyName)}</p>
    </div>
  `;
  return { subject, text, html };
}

export async function sendVerifiedReviewInvitationEmail(
  input: SendVerifiedReviewInvitationEmailInput,
): Promise<VerifiedReviewInvitationEmailResult> {
  const apiKey = resolveBrevoApiKey();
  const from = process.env.LEAD_FROM_EMAIL;
  const recipient = resolveEmailRecipient({
    email: input.customerEmail,
    name: input.customerName,
  });

  if (!apiKey || !from || !recipient) {
    return {
      ok: false,
      code: "configuration",
      message: "Brevo is not configured.",
    };
  }

  const parsedSender = parseSender(from);
  const primeView = isPrimeViewCompany(input.companyName);
  const sender = primeView
    ? { name: primeViewSite.name, email: parsedSender.email }
    : parsedSender;
  const email = buildVerifiedReviewInvitationEmail(input);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [recipient],
        ...(primeView
          ? { replyTo: { email: primeViewSite.email, name: primeViewSite.name } }
          : {}),
        subject: email.subject,
        textContent: email.text,
        htmlContent: email.html,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as BrevoResponse;

    if (!response.ok) {
      return {
        ok: false,
        code: "provider",
        message: data.message ?? data.code ?? "Brevo rejected the review invitation email.",
      };
    }

    return { ok: true, providerId: data.messageId ?? null };
  } catch {
    return {
      ok: false,
      code: "network",
      message: "Could not contact Brevo.",
    };
  }
}
