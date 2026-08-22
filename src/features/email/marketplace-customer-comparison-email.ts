import "server-only";

import {
  resolveBrevoApiKey,
  resolveEmailRecipient,
} from "@/lib/email-runtime-config";

export type MarketplaceCustomerComparisonEmailInput = {
  recipientEmail: string;
  customerName: string;
  quoteReferenceId: string;
  comparisonUrl: string;
  idempotencyKey: string;
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

export function buildMarketplaceCustomerComparisonEmail(input: MarketplaceCustomerComparisonEmailInput) {
  const customerName = input.customerName.trim() || "kund";
  const subject = `Nytt offertförslag på Proffera · ${input.quoteReferenceId}`;
  const text = [
    `Hej ${customerName},`,
    "",
    "Ett företag har svarat på din offertförfrågan på Proffera.",
    "Du kan använda din personliga länk för att jämföra alla inkomna offerter och välja ett företag.",
    "Kontaktuppgifter delas först när du väljer vinnande offert.",
    "",
    input.comparisonUrl,
    "",
    "English: A company has replied to your Proffera request. Use the secure link above to compare offers and choose one provider. Contact details are unlocked only after your selection.",
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
            <p style="margin:0;color:#536057;font-size:15px;line-height:1.7;">Hej ${escapeHtml(customerName)},</p>
            <h1 style="margin:14px 0 10px;font-size:24px;line-height:1.25;color:#17201a;">Du har fått ett nytt offertförslag</h1>
            <p style="margin:0;color:#536057;font-size:15px;line-height:1.7;">Jämför inkomna offerter och välj ett företag via din personliga Proffera-länk.</p>
            <p style="margin:18px 0;color:#657068;font-size:13px;line-height:1.7;">Kontaktuppgifter mellan dig och företaget låses upp först när du väljer en vinnande offert.</p>
            <p style="margin:22px 0;"><a href="${escapeHtml(input.comparisonUrl)}" style="display:inline-block;border-radius:12px;background:#17452f;color:#ffffff;padding:14px 22px;text-decoration:none;font-weight:700;">Jämför offerter</a></p>
            <p style="margin:26px 0 0;color:#7a837d;font-size:12px;line-height:1.6;">English: Use the secure link above to compare your Proffera offers and choose one provider.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

export async function sendMarketplaceCustomerComparisonEmail(input: MarketplaceCustomerComparisonEmailInput) {
  const apiKey = resolveBrevoApiKey();
  const from = process.env.LEAD_FROM_EMAIL;
  const recipient = resolveEmailRecipient({
    email: input.recipientEmail,
    name: input.customerName || "Proffera customer",
  });
  if (!apiKey || !from || !recipient) {
    return { ok: false as const, code: "configuration", providerMessageId: null };
  }

  const email = buildMarketplaceCustomerComparisonEmail(input);
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        sender: parseSender(from),
        to: [recipient],
        subject: email.subject,
        textContent: email.text,
        htmlContent: email.html,
        // Brevo's transactional-email schema expects idempotency inside the
        // payload's custom headers map, not as a transport-level HTTP header.
        headers: { idempotencyKey: input.idempotencyKey },
        tags: ["marketplace-customer-comparison"],
      }),
    });
    const data = (await response.json().catch(() => ({}))) as BrevoResponse;
    if (!response.ok) {
      if (data.code === "duplicate_parameter") {
        return {
          ok: false as const,
          code: "duplicate" as const,
          providerMessageId: null,
          message: data.message ?? data.code,
        };
      }
      console.error("Brevo rejected marketplace customer comparison email", {
        status: response.status,
        providerCode: data.code ?? null,
      });
      return {
        ok: false as const,
        code: "provider" as const,
        providerMessageId: null,
        message: data.message ?? data.code ?? "Brevo rejected the email.",
      };
    }
    return { ok: true as const, providerMessageId: data.messageId ?? null };
  } catch (error) {
    console.error("Brevo marketplace customer comparison request failed", error);
    return { ok: false as const, code: "network" as const, providerMessageId: null };
  }
}
