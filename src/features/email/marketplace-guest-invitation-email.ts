import "server-only";

export type MarketplaceGuestInvitationEmailInput = {
  recipientEmail: string;
  companyName: string;
  quoteReferenceId: string;
  category: string;
  serviceType: string;
  city: string;
  preferredDate: string;
  replyUrl: string;
  optOutUrl: string;
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

function parseSender(raw: string) {
  const match = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1]?.trim() || "Proffera", email: match[2]?.trim() || "" };
  return { name: "Proffera", email: raw.trim() };
}

export function buildMarketplaceGuestInvitationEmail(input: MarketplaceGuestInvitationEmailInput) {
  const subject = `Ny offertförfrågan i ${input.city}: ${input.category}`;
  const preferredDate = input.preferredDate.trim() || "Inte angivet";
  const text = [
    `Hej ${input.companyName},`,
    "",
    `En kund på Proffera söker hjälp med ${input.serviceType} i ${input.city}.`,
    "",
    `Referens: ${input.quoteReferenceId}`,
    `Kategori: ${input.category}`,
    `Tjänst: ${input.serviceType}`,
    `Önskat datum: ${preferredDate}`,
    "",
    "Kundens kontaktuppgifter delas inte i detta steg.",
    "Öppna förfrågan och svara med pris eller uppskattning:",
    input.replyUrl,
    "",
    "Vill ni inte få fler sådana förfrågningar från Proffera?",
    input.optOutUrl,
    "",
    "Proffera",
  ].join("\n");

  const html = `<!doctype html>
<html lang="sv">
  <body style="margin:0;padding:0;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#17201a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;padding:24px 12px;background:#f3f6f4;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dfe7e1;">
          <tr><td style="padding:22px 28px;background:#173e2b;color:#ffffff;font-size:18px;font-weight:800;">Proffera</td></tr>
          <tr><td style="padding:30px 28px;">
            <p style="margin:0;color:#536057;font-size:15px;line-height:1.7;">Hej ${escapeHtml(input.companyName)},</p>
            <h1 style="margin:14px 0 10px;font-size:24px;line-height:1.25;color:#17201a;">En kund söker ${escapeHtml(input.serviceType)} i ${escapeHtml(input.city)}</h1>
            <p style="margin:0;color:#536057;font-size:15px;line-height:1.7;">Ni kan läsa förfrågan och svara med ett fast pris, en uppskattning eller meddela att ett platsbesök behövs.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0;background:#f7f9f7;border-radius:14px;padding:8px 16px;">
              <tr><td style="padding:8px 0;font-weight:700;">Referens</td><td style="padding:8px 0;">${escapeHtml(input.quoteReferenceId)}</td></tr>
              <tr><td style="padding:8px 0;font-weight:700;">Kategori</td><td style="padding:8px 0;">${escapeHtml(input.category)}</td></tr>
              <tr><td style="padding:8px 0;font-weight:700;">Tjänst</td><td style="padding:8px 0;">${escapeHtml(input.serviceType)}</td></tr>
              <tr><td style="padding:8px 0;font-weight:700;">Önskat datum</td><td style="padding:8px 0;">${escapeHtml(preferredDate)}</td></tr>
            </table>
            <p style="margin:0 0 18px;color:#657068;font-size:13px;line-height:1.7;">Kundens namn, e-post och telefonnummer delas inte i detta steg.</p>
            <p style="margin:22px 0;"><a href="${escapeHtml(input.replyUrl)}" style="display:inline-block;border-radius:12px;background:#17452f;color:#ffffff;padding:14px 22px;text-decoration:none;font-weight:700;">Visa förfrågan och svara</a></p>
            <p style="margin:26px 0 0;color:#7a837d;font-size:12px;line-height:1.6;">Vill ni inte få fler sådana förfrågningar? <a href="${escapeHtml(input.optOutUrl)}" style="color:#536057;">Avregistrera denna företagsadress</a>.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

export async function sendMarketplaceGuestInvitationEmail(input: MarketplaceGuestInvitationEmailInput) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: false as const, code: "configuration", providerMessageId: null };
  }

  const email = buildMarketplaceGuestInvitationEmail(input);
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        sender: parseSender(from),
        to: [{ email: input.recipientEmail, name: input.companyName }],
        subject: email.subject,
        textContent: email.text,
        htmlContent: email.html,
        tags: ["marketplace-guest-invitation"],
      }),
    });
    const data = (await response.json().catch(() => ({}))) as BrevoResponse;
    if (!response.ok) {
      console.error("Brevo rejected marketplace guest invitation", {
        status: response.status,
        providerCode: data.code ?? null,
      });
      return {
        ok: false as const,
        code: "provider",
        providerMessageId: null,
        message: data.message ?? data.code ?? "Brevo rejected the email.",
      };
    }
    return { ok: true as const, providerMessageId: data.messageId ?? null };
  } catch (error) {
    console.error("Brevo marketplace guest invitation request failed", error);
    return { ok: false as const, code: "network", providerMessageId: null };
  }
}
