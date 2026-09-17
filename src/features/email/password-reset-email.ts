import "server-only";

import {
  resolveBrevoApiKey,
  resolveEmailRecipient,
} from "@/lib/email-runtime-config";
import { resolveMarketplacePublicBaseUrl } from "@/lib/marketplace-public-base-url";

export type PasswordResetLocale = "sv" | "en";

type BrevoResponse = {
  messageId?: string;
  message?: string;
  code?: string;
};

const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseSender(raw: string) {
  const match = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1]?.trim() || "Proffera", email: match[2]?.trim() || "" };
  return { name: "Proffera", email: raw.trim() };
}

export function passwordResetLocaleFromGeneratedUrl(generatedUrl: string): PasswordResetLocale {
  try {
    const generated = new URL(generatedUrl);
    const callback = generated.searchParams.get("callbackURL");
    if (!callback) return "sv";
    const callbackUrl = new URL(callback, "https://www.proffera.se");
    return callbackUrl.searchParams.get("lang") === "en" ? "en" : "sv";
  } catch {
    return "sv";
  }
}

/**
 * Keeps the Better Auth reset token in a URL fragment so it is available to the
 * browser but is not sent in the HTTP request URL to Proffera/Vercel.
 */
export function buildPasswordResetBrowserUrl(token: string, locale: PasswordResetLocale) {
  const normalizedToken = token.trim();
  if (!RESET_TOKEN_PATTERN.test(normalizedToken)) {
    throw new Error("Invalid password reset token format");
  }

  const url = new URL("/aterstall-losenord", resolveMarketplacePublicBaseUrl());
  if (locale === "en") url.searchParams.set("lang", "en");
  url.hash = new URLSearchParams({ token: normalizedToken }).toString();
  return url.toString();
}

export function buildPasswordResetEmail(input: {
  resetUrl: string;
  locale: PasswordResetLocale;
}) {
  const resetUrl = input.resetUrl;
  const isEnglish = input.locale === "en";
  const subject = isEnglish
    ? "Reset your Proffera password"
    : "Återställ ditt lösenord på Proffera";
  const title = isEnglish ? "Reset your password" : "Återställ ditt lösenord";
  const intro = isEnglish
    ? "We received a request to reset the password for your Proffera account."
    : "Vi har fått en begäran om att återställa lösenordet för ditt Proffera-konto.";
  const action = isEnglish ? "Choose a new password" : "Välj ett nytt lösenord";
  const expiry = isEnglish
    ? "The link is valid for 60 minutes and can only be used once."
    : "Länken gäller i 60 minuter och kan bara användas en gång.";
  const ignore = isEnglish
    ? "If you did not request this, you can ignore this email. Your password will not change."
    : "Om du inte begärde detta kan du ignorera mejlet. Ditt lösenord ändras inte.";

  const text = [
    title,
    "",
    intro,
    "",
    `${action}:`,
    resetUrl,
    "",
    expiry,
    ignore,
    "",
    "Proffera",
  ].join("\n");

  const html = `<!doctype html>
<html lang="${isEnglish ? "en" : "sv"}">
  <body style="margin:0;padding:0;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#17201a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;padding:24px 12px;background:#f3f6f4;"><tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dfe7e1;">
        <tr><td style="padding:22px 28px;background:#173e2b;color:#ffffff;font-size:18px;font-weight:800;">Proffera</td></tr>
        <tr><td style="padding:30px 28px;">
          <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;color:#17201a;">${title}</h1>
          <p style="margin:0;color:#536057;font-size:15px;line-height:1.7;">${intro}</p>
          <p style="margin:24px 0;"><a href="${escapeHtml(resetUrl)}" style="display:inline-block;border-radius:12px;background:#17452f;color:#ffffff;padding:14px 22px;text-decoration:none;font-weight:700;">${action}</a></p>
          <p style="margin:0;color:#657068;font-size:13px;line-height:1.7;">${expiry}</p>
          <p style="margin:14px 0 0;color:#657068;font-size:13px;line-height:1.7;">${ignore}</p>
        </td></tr>
      </table>
    </td></tr></table>
  </body>
</html>`;

  return { subject, text, html };
}

export async function sendPasswordResetEmail(input: {
  recipientEmail: string;
  token: string;
  locale: PasswordResetLocale;
}) {
  const apiKey = resolveBrevoApiKey();
  const from = process.env.LEAD_FROM_EMAIL;
  const recipient = resolveEmailRecipient({ email: input.recipientEmail });
  if (!apiKey || !from || !recipient) {
    console.error("Password reset email is not configured for this runtime");
    return { ok: false as const, code: "configuration", providerMessageId: null };
  }

  let resetUrl: string;
  try {
    resetUrl = buildPasswordResetBrowserUrl(input.token, input.locale);
  } catch {
    console.error("Password reset email rejected an invalid token format");
    return { ok: false as const, code: "token", providerMessageId: null };
  }

  const email = buildPasswordResetEmail({ resetUrl, locale: input.locale });
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        sender: parseSender(from),
        to: [recipient],
        subject: email.subject,
        textContent: email.text,
        htmlContent: email.html,
        tags: ["password-reset"],
      }),
    });
    const data = (await response.json().catch(() => ({}))) as BrevoResponse;
    if (!response.ok) {
      console.error("Brevo rejected password reset email", {
        status: response.status,
        providerCode: data.code ?? null,
      });
      return { ok: false as const, code: "provider", providerMessageId: null };
    }
    return { ok: true as const, providerMessageId: data.messageId ?? null };
  } catch (error) {
    console.error("Brevo password reset request failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return { ok: false as const, code: "network", providerMessageId: null };
  }
}
