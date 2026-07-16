type SendLeadEmailInput = {
  leadRef: string;
  companyName: string;
  companyEmail: string;
  category: string;
  serviceType: string;
  city: string;
  description: string;
};

type SendBookingConfirmationEmailInput = {
  customerName: string;
  customerEmail: string;
  companyName: string;
  bookingTitle: string;
  service: string;
  startsAt: string;
  endsAt: string;
  city: string;
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

function formatBookingTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

export function buildBookingConfirmationEmail(input: SendBookingConfirmationEmailInput) {
  const start = formatBookingTime(input.startsAt);
  const end = formatBookingTime(input.endsAt);
  const subject = `Bokningsförfrågan mottagen – ${input.companyName}`;
  const text = [
    `Hej ${input.customerName},`,
    "",
    `Vi har tagit emot din bokningsförfrågan hos ${input.companyName}.`,
    "",
    `Tjänst: ${input.service || input.bookingTitle}`,
    `Start: ${start}`,
    `Slut: ${end}`,
    input.city ? `Ort: ${input.city}` : "",
    "",
    "Företaget bekräftar tiden separat. Hör av dig till företaget om du behöver ändra eller avboka förfrågan.",
    "",
    `Med vänliga hälsningar`,
    input.companyName,
  ].filter(Boolean).join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #17201a;">
      <p>Hej ${escapeHtml(input.customerName)},</p>
      <p>Vi har tagit emot din bokningsförfrågan hos <strong>${escapeHtml(input.companyName)}</strong>.</p>
      <ul>
        <li><strong>Tjänst:</strong> ${escapeHtml(input.service || input.bookingTitle)}</li>
        <li><strong>Start:</strong> ${escapeHtml(start)}</li>
        <li><strong>Slut:</strong> ${escapeHtml(end)}</li>
        ${input.city ? `<li><strong>Ort:</strong> ${escapeHtml(input.city)}</li>` : ""}
      </ul>
      <p>Företaget bekräftar tiden separat. Hör av dig till företaget om du behöver ändra eller avboka förfrågan.</p>
      <p>Med vänliga hälsningar<br />${escapeHtml(input.companyName)}</p>
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

export async function sendBookingConfirmationEmail(input: SendBookingConfirmationEmailInput) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;

  if (!apiKey) {
    return { ok: false as const, message: "BREVO_API_KEY saknas i Vercel." };
  }

  if (!from) {
    return { ok: false as const, message: "LEAD_FROM_EMAIL saknas i Vercel." };
  }

  const sender = parseSender(from);
  const email = buildBookingConfirmationEmail(input);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
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
      return { ok: false as const, message: data.message ?? data.code ?? "Kunde inte skicka bokningsbekräftelse via Brevo." };
    }

    return { ok: true as const, providerId: data.messageId ?? null };
  } catch {
    return { ok: false as const, message: "Kunde inte kontakta Brevo." };
  }
}
