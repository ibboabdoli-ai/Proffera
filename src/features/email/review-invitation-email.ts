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

export function buildVerifiedReviewInvitationEmail(
  input: SendVerifiedReviewInvitationEmailInput,
) {
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
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;

  if (!apiKey || !from) {
    return {
      ok: false,
      code: "configuration",
      message: "Brevo is not configured.",
    };
  }

  const sender = parseSender(from);
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
        to: [{ email: input.customerEmail, name: input.customerName }],
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
