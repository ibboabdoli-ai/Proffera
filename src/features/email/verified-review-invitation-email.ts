import "server-only";

export type VerifiedReviewInvitationEmailInput = {
  customerName: string;
  customerEmail: string;
  companyName: string;
  service: string;
  reviewUrl: string;
  expiresAt: string;
  language: "sv" | "en";
  timeZone: string;
  primaryColor: string;
};

type BrevoResponse = {
  messageId?: string;
};

export type VerifiedReviewInvitationEmailResult =
  | { ok: true; providerMessageId: string | null }
  | { ok: false; code: "configuration" | "provider" | "network" };

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

function normalizeColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#173e2b";
}

function formatExpiry(value: string, language: "sv" | "en", timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  try {
    return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "sv-SE", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "sv-SE", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/Stockholm",
    }).format(date);
  }
}

export function buildVerifiedReviewInvitationEmail(
  input: VerifiedReviewInvitationEmailInput,
) {
  const isEnglish = input.language === "en";
  const expiry = formatExpiry(input.expiresAt, input.language, input.timeZone);
  const color = normalizeColor(input.primaryColor);
  const subject = isEnglish
    ? `Leave a verified review – ${input.companyName}`
    : `Lämna ett verifierat omdöme – ${input.companyName}`;

  const text = isEnglish
    ? [
        `Hello ${input.customerName},`,
        "",
        `Your ${input.service} booking with ${input.companyName} is complete.`,
        "Please use your private link to leave a verified review:",
        input.reviewUrl,
        "",
        `The link expires on ${expiry} and can only be used once. Do not share it with anyone else.`,
        "",
        `Kind regards,`,
        input.companyName,
        "Powered by Proffera",
      ].join("\n")
    : [
        `Hej ${input.customerName},`,
        "",
        `Din bokning för ${input.service} hos ${input.companyName} är slutförd.`,
        "Använd din privata länk för att lämna ett verifierat omdöme:",
        input.reviewUrl,
        "",
        `Länken gäller till ${expiry} och kan bara användas en gång. Dela den inte med någon annan.`,
        "",
        "Med vänliga hälsningar",
        input.companyName,
        "Powered by Proffera",
      ].join("\n");

  const heading = isEnglish ? "How did it go?" : "Hur gick det?";
  const introduction = isEnglish
    ? `Your <strong>${escapeHtml(input.service)}</strong> booking with ${escapeHtml(input.companyName)} is complete. Your feedback helps the company and future customers.`
    : `Din bokning för <strong>${escapeHtml(input.service)}</strong> hos ${escapeHtml(input.companyName)} är slutförd. Ditt omdöme hjälper företaget och framtida kunder.`;
  const button = isEnglish ? "Leave verified review" : "Lämna verifierat omdöme";
  const security = isEnglish
    ? `This private link expires on ${escapeHtml(expiry)} and can only be used once. Do not share it.`
    : `Den privata länken gäller till ${escapeHtml(expiry)} och kan bara användas en gång. Dela den inte.`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;max-width:640px;margin:0 auto;">
      <div style="border:1px solid #dfe6df;border-radius:20px;overflow:hidden;background:#ffffff;">
        <div style="background:${color};color:#ffffff;padding:24px 28px;">
          <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#e6efe8;">${isEnglish ? "Verified review" : "Verifierat omdöme"}</p>
          <h1 style="margin:8px 0 0;font-size:25px;line-height:1.25;">${escapeHtml(heading)}</h1>
        </div>
        <div style="padding:26px 28px;">
          <p>${isEnglish ? "Hello" : "Hej"} ${escapeHtml(input.customerName)},</p>
          <p>${introduction}</p>
          <p style="margin:24px 0;">
            <a href="${escapeHtml(input.reviewUrl)}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:12px;">${button}</a>
          </p>
          <p style="font-size:13px;color:#667168;">${security}</p>
          <p style="margin-top:26px;">${isEnglish ? "Kind regards" : "Med vänliga hälsningar"}<br /><strong>${escapeHtml(input.companyName)}</strong></p>
        </div>
      </div>
      <p style="text-align:center;font-size:12px;color:#8a938d;margin-top:14px;">Powered by Proffera</p>
    </div>
  `;

  return { subject, text, html };
}

export async function sendVerifiedReviewInvitationEmail(
  input: VerifiedReviewInvitationEmailInput,
): Promise<VerifiedReviewInvitationEmailResult> {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false, code: "configuration" };

  const email = buildVerifiedReviewInvitationEmail(input);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: parseSender(from),
        to: [{ email: input.customerEmail, name: input.customerName }],
        subject: email.subject,
        textContent: email.text,
        htmlContent: email.html,
        tags: ["verified-review-invitation"],
      }),
    });
    const data = (await response.json().catch(() => ({}))) as BrevoResponse;
    if (!response.ok) return { ok: false, code: "provider" };
    return { ok: true, providerMessageId: data.messageId ?? null };
  } catch {
    return { ok: false, code: "network" };
  }
}
