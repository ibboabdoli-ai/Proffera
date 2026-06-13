type SendLeadEmailInput = {
  leadRef: string;
  companyName: string;
  companyEmail: string;
  category: string;
  serviceType: string;
  city: string;
  description: string;
};

type ResendResponse = {
  id?: string;
  message?: string;
  name?: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeIdempotencyValue(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
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
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;

  if (!apiKey || !from) {
    return { ok: false as const, message: "E-postprovider är inte konfigurerad." };
  }

  const email = buildLeadEmail(input);
  const idempotencyKey = [
    "lead",
    safeIdempotencyValue(input.leadRef),
    safeIdempotencyValue(input.companyEmail),
  ].join("-");

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from,
        to: [input.companyEmail],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as ResendResponse;

    if (!response.ok) {
      return { ok: false as const, message: data.message ?? "Kunde inte skicka mejl." };
    }

    return { ok: true as const, providerId: data.id ?? null };
  } catch {
    return { ok: false as const, message: "Kunde inte kontakta e-postprovider." };
  }
}
