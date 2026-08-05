type SendCustomerBookingPortalEmailInput = {
  customerName: string;
  customerEmail: string;
  companyName: string;
  portalUrl: string;
};

type BrevoResponse = {
  messageId?: string;
  message?: string;
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

export async function sendCustomerBookingPortalEmail(input: SendCustomerBookingPortalEmailInput) {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const senderValue = process.env.BREVO_SENDER?.trim() || process.env.BREVO_FROM?.trim();
  if (!apiKey || !senderValue) return { ok: false as const, error: "configuration" };

  const sender = parseSender(senderValue);
  const subject = `Hantera din bokning – ${input.companyName}`;
  const text = [
    `Hej ${input.customerName},`,
    "",
    "Din privata bokningssida är klar.",
    "Där kan du se dina bokningar, lägga till tiden i kalendern och avboka en framtida bokning.",
    "",
    input.portalUrl,
    "",
    "Länken är personlig. Dela den inte med andra.",
    "",
    `Med vänliga hälsningar`,
    input.companyName,
    "Powered by Proffera",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;max-width:620px;margin:0 auto;">
      <p>Hej ${escapeHtml(input.customerName)},</p>
      <h1 style="font-size:24px;margin:16px 0;">Hantera din bokning</h1>
      <p>På din privata bokningssida kan du se dina bokningar, lägga till tiden i kalendern och avboka en framtida bokning.</p>
      <p style="margin:28px 0;">
        <a href="${escapeHtml(input.portalUrl)}" style="display:inline-block;background:#17452f;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:12px;">Öppna mina bokningar</a>
      </p>
      <p style="font-size:13px;color:#667168;">Länken är personlig. Dela den inte med andra.</p>
      <p>Med vänliga hälsningar<br /><strong>${escapeHtml(input.companyName)}</strong></p>
      <p style="font-size:12px;color:#8a938d;">Powered by Proffera</p>
    </div>
  `;

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender,
      to: [{ email: input.customerEmail, name: input.customerName }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });

  const body = (await response.json().catch(() => ({}))) as BrevoResponse;
  return response.ok
    ? { ok: true as const, messageId: body.messageId }
    : { ok: false as const, error: body.message || `HTTP ${response.status}` };
}
