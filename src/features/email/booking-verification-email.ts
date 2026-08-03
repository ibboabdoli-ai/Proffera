type BookingVerificationEmailInput = {
  customerName: string;
  customerEmail: string;
  companyName: string;
  code: string;
  expiresMinutes?: number;
};

type BrevoResponse = { messageId?: string; message?: string; code?: string };

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
  return match ? { name: match[1] || "Proffera", email: match[2] } : { name: "Proffera", email: value.trim() };
}

export async function sendBookingVerificationEmail(input: BookingVerificationEmailInput) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false as const, message: "Email provider is not configured." };

  const expiresMinutes = input.expiresMinutes ?? 10;
  const subject = `${input.code} – verifiera din bokning hos ${input.companyName}`;
  const text = [
    `Hej ${input.customerName},`,
    "",
    `Din verifieringskod är: ${input.code}`,
    `Koden gäller i ${expiresMinutes} minuter.`,
    "",
    "Bokningen skapas först när koden har verifierats.",
    "Om du inte gjorde bokningen kan du ignorera mejlet.",
  ].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a"><p>Hej ${escapeHtml(input.customerName)},</p><p>Använd koden nedan för att verifiera din bokning hos <strong>${escapeHtml(input.companyName)}</strong>.</p><p style="font-size:32px;font-weight:800;letter-spacing:8px;margin:24px 0">${escapeHtml(input.code)}</p><p>Koden gäller i ${expiresMinutes} minuter. Bokningen skapas först när koden har verifierats.</p><p>Om du inte gjorde bokningen kan du ignorera mejlet.</p></div>`;

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ sender: parseSender(from), to: [{ email: input.customerEmail, name: input.customerName }], subject, textContent: text, htmlContent: html }),
    });
    const data = (await response.json().catch(() => ({}))) as BrevoResponse;
    return response.ok
      ? { ok: true as const, providerId: data.messageId ?? null }
      : { ok: false as const, message: data.message ?? data.code ?? "Email delivery failed." };
  } catch {
    return { ok: false as const, message: "Email delivery failed." };
  }
}
