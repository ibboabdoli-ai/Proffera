type AuthPasswordResetEmailInput = {
  email: string;
  name?: string | null;
  url: string;
};

type BrevoResponse = { messageId?: string; message?: string; code?: string };

const DEFAULT_AUTH_FROM_EMAIL = "Proffera <booking@proffera.se>";
const DEFAULT_AUTH_REPLY_TO_EMAIL = "info@proffera.se";
const AUTH_PASSWORD_RESET_TAG = "auth-password-reset";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function parseSender(value: string) {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match
    ? { name: match[1] || "Proffera", email: match[2] }
    : { name: "Proffera", email: value.trim() };
}

function resolveSender() {
  return parseSender(
    process.env.AUTH_FROM_EMAIL?.trim()
      || process.env.BOOKING_FROM_EMAIL?.trim()
      || DEFAULT_AUTH_FROM_EMAIL,
  );
}

function resolveReplyTo() {
  return parseSender(
    process.env.AUTH_REPLY_TO_EMAIL?.trim()
      || process.env.BOOKING_REPLY_TO_EMAIL?.trim()
      || DEFAULT_AUTH_REPLY_TO_EMAIL,
  );
}

export async function sendAuthPasswordResetEmail(input: AuthPasswordResetEmailInput) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { ok: false as const, message: "Email provider is not configured." };
  }

  const name = input.name?.trim() || "Proffera-användare";
  const safeName = escapeHtml(name);
  const safeUrl = escapeHtml(input.url);
  const subject = "Återställ ditt lösenord för Proffera";
  const text = [
    `Hej ${name},`,
    "",
    "Du har begärt att återställa lösenordet för ditt Proffera-konto.",
    "Öppna länken nedan för att välja ett nytt lösenord:",
    input.url,
    "",
    "Om du inte begärde detta kan du ignorera mejlet.",
    "",
    "---",
    "",
    "You requested a password reset for your Proffera account.",
    "Open the link above to choose a new password. If you did not request this, you can ignore this email.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;max-width:620px;margin:0 auto">
      <p>Hej ${safeName},</p>
      <p>Du har begärt att återställa lösenordet för ditt Proffera-konto.</p>
      <p style="margin:28px 0">
        <a href="${safeUrl}" style="display:inline-block;background:#17452f;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Återställ lösenord</a>
      </p>
      <p style="font-size:13px;color:#667168">Om du inte begärde detta kan du ignorera mejlet.</p>
      <hr style="border:0;border-top:1px solid #dfe5dd;margin:28px 0" />
      <p>You requested a password reset for your Proffera account. Use the button above to choose a new password.</p>
    </div>
  `;

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: resolveSender(),
        replyTo: resolveReplyTo(),
        to: [{ email: input.email, name }],
        subject,
        textContent: text,
        htmlContent: html,
        tags: [AUTH_PASSWORD_RESET_TAG],
      }),
    });

    const data = (await response.json().catch(() => ({}))) as BrevoResponse;
    return response.ok
      ? { ok: true as const, providerId: data.messageId ?? null }
      : { ok: false as const, message: data.message ?? data.code ?? "Email delivery failed." };
  } catch {
    return { ok: false as const, message: "Email delivery failed." };
  }
}
