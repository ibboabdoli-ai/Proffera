type SendLeadEmailInput = {
  leadRef: string;
  companyName: string;
  companyEmail: string;
  category: string;
  serviceType: string;
  city: string;
  description: string;
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

export function buildLeadEmail(input: SendLeadEmailInput) {
  const subject = `Ny förfrågan från Proffera: ${input.category} i ${input.city}`;
  const text = [
    `Hej ${input.companyName},`,
    "",
    "Ni har en matchad förfrågan i Proffera.",
    "",
    `Referens: ${input.leadRef}`,
    `Kategori: ${input.category}`,
    `Tjänst: ${input.serviceType}`,
    `Ort: ${input.city}`,
    "",
    "Beskrivning:",
    input.description,
    "",
    "Svara på detta mejl om ni vill gå vidare med uppdraget.",
    "",
    "Med vänliga hälsningar",
    "Proffera",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #17201a;">
      <p>Hej ${escapeHtml(input.companyName)},</p>
      <p>Ni har en matchad förfrågan i Proffera.</p>
      <ul>
        <li><strong>Referens:</strong> ${escapeHtml(input.leadRef)}</li>
        <li><strong>Kategori:</strong> ${escapeHtml(input.category)}</li>
        <li><strong>Tjänst:</strong> ${escapeHtml(input.serviceType)}</li>
        <li><strong>Ort:</strong> ${escapeHtml(input.city)}</li>
      </ul>
      <p><strong>Beskrivning:</strong></p>
      <p>${escapeHtml(input.description).replaceAll("\n", "<br />")}</p>
      <p>Svara på detta mejl om ni vill gå vidare med uppdraget.</p>
      <p>Med vänliga hälsningar<br />Proffera</p>
    </div>
  `;

  return { subject, text, html };
}

export async function sendLeadEmail(input: SendLeadEmailInput) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;

  if (!apiKey) {
    return { ok: false as const, message: "BREVO_API_KEY saknas i Vercel." };
  }

  if (!from) {
    return { ok: false as const, message: "LEAD_FROM_EMAIL saknas i Vercel." };
  }

  const sender = parseSender(from);
  const email = buildLeadEmail(input);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender,
        to: [{ email: input.companyEmail, name: input.companyName }],
        subject: email.subject,
        textContent: email.text,
        htmlContent: email.html,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as BrevoResponse;

    if (!response.ok) {
      return { ok: false as const, message: data.message ?? data.code ?? "Kunde inte skicka mejl via Brevo." };
    }

    return { ok: true as const, providerId: data.messageId ?? null };
  } catch {
    return { ok: false as const, message: "Kunde inte kontakta Brevo." };
  }
}
