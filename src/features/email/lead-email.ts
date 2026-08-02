import type { WorkspaceTimeZone } from "@/lib/workspace-market";

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
  timeZone?: WorkspaceTimeZone;
};

type SendBookingOwnerNotificationEmailInput = {
  ownerEmail: string;
  companyName: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  service: string;
  startsAt: string;
  endsAt: string;
  city: string;
  timeZone?: WorkspaceTimeZone;
};

type SendBookingStatusEmailInput = {
  customerName: string;
  customerEmail: string;
  companyName: string;
  status: "confirmed" | "cancelled";
  service: string;
  startsAt: string;
  endsAt: string;
  city: string;
  timeZone?: WorkspaceTimeZone;
};

type SendWorkspaceInvitationEmailInput = {
  companyName: string;
  contactName: string;
  email: string;
  activationUrl: string;
  expiresInHours: number;
};

type SendWorkspaceMemberInvitationEmailInput = {
  companyName: string; contactName: string; email: string; activationUrl: string; expiresInHours: number;
};

type SendPrimeViewQuoteEmailsInput = {
  quote: {
    name: string;
    phone: string;
    email: string;
    postcode: string;
    service: string;
    message: string;
  };
  recipient: {
    name: string;
    email: string;
  };
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

export function buildPrimeViewQuoteOwnerEmail(input: SendPrimeViewQuoteEmailsInput["quote"]) {
  const subject = `New website quote request – ${input.service}`;
  const text = [
    "New website quote request",
    "",
    `Name: ${input.name}`,
    `Phone: ${input.phone}`,
    `Email: ${input.email}`,
    `Postcode: ${input.postcode}`,
    `Service: ${input.service}`,
    "",
    "Message:",
    input.message,
    "",
    "Reply directly to this email to contact the customer.",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#09183a;">
      <h1 style="margin:0 0 20px;font-size:24px;">New website quote request</h1>
      <table style="border-collapse:collapse;max-width:620px;width:100%;">
        <tr><td style="padding:7px 16px 7px 0;font-weight:700;vertical-align:top;">Name</td><td style="padding:7px 0;">${escapeHtml(input.name)}</td></tr>
        <tr><td style="padding:7px 16px 7px 0;font-weight:700;vertical-align:top;">Phone</td><td style="padding:7px 0;"><a href="tel:${escapeHtml(input.phone)}">${escapeHtml(input.phone)}</a></td></tr>
        <tr><td style="padding:7px 16px 7px 0;font-weight:700;vertical-align:top;">Email</td><td style="padding:7px 0;"><a href="mailto:${escapeHtml(input.email)}">${escapeHtml(input.email)}</a></td></tr>
        <tr><td style="padding:7px 16px 7px 0;font-weight:700;vertical-align:top;">Postcode</td><td style="padding:7px 0;">${escapeHtml(input.postcode)}</td></tr>
        <tr><td style="padding:7px 16px 7px 0;font-weight:700;vertical-align:top;">Service</td><td style="padding:7px 0;">${escapeHtml(input.service)}</td></tr>
      </table>
      <h2 style="margin:24px 0 8px;font-size:18px;">Message</h2>
      <p style="margin:0;white-space:pre-wrap;">${escapeHtml(input.message)}</p>
      <p style="margin-top:24px;color:#475569;">Reply directly to this email to contact the customer.</p>
    </div>
  `;

  return { subject, text, html };
}

export function buildPrimeViewQuoteConfirmationEmail(input: SendPrimeViewQuoteEmailsInput["quote"]) {
  const subject = "We received your quote request – PrimeView Window Care";
  const text = [
    `Hello ${input.name},`,
    "",
    "Thank you for contacting PrimeView Window Care.",
    "We have received your request and will get back to you with a clear, no-obligation quote.",
    "",
    `Service: ${input.service}`,
    `Postcode: ${input.postcode}`,
    "",
    "Kind regards,",
    "PrimeView Window Care",
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#09183a;">
      <h1 style="margin:0 0 20px;font-size:24px;">Thank you for contacting PrimeView</h1>
      <p>Hello ${escapeHtml(input.name)},</p>
      <p>We have received your request and will get back to you with a clear, no-obligation quote.</p>
      <table style="border-collapse:collapse;max-width:620px;width:100%;">
        <tr><td style="padding:7px 16px 7px 0;font-weight:700;">Service</td><td style="padding:7px 0;">${escapeHtml(input.service)}</td></tr>
        <tr><td style="padding:7px 16px 7px 0;font-weight:700;">Postcode</td><td style="padding:7px 0;">${escapeHtml(input.postcode)}</td></tr>
      </table>
      <p style="margin-top:28px;">Kind regards,<br /><strong>PrimeView Window Care</strong></p>
    </div>
  `;

  return { subject, text, html };
}

function formatBookingTime(value: string, timeZone: WorkspaceTimeZone = "Europe/Stockholm") {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

export function buildBookingConfirmationEmail(input: SendBookingConfirmationEmailInput) {
  const start = formatBookingTime(input.startsAt, input.timeZone);
  const end = formatBookingTime(input.endsAt, input.timeZone);
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

export function buildBookingOwnerNotificationEmail(input: SendBookingOwnerNotificationEmailInput) {
  const start = formatBookingTime(input.startsAt, input.timeZone);
  const end = formatBookingTime(input.endsAt, input.timeZone);
  const subject = `Ny bokningsförfrågan – ${input.service}`;
  const text = [
    `Hej ${input.companyName},`,
    "",
    "En ny bokningsförfrågan har kommit in via Proffera.",
    "",
    `Kund: ${input.customerName}`,
    input.customerEmail ? `E-post: ${input.customerEmail}` : "",
    input.customerPhone ? `Telefon: ${input.customerPhone}` : "",
    `Tjänst: ${input.service}`,
    `Start: ${start}`,
    `Slut: ${end}`,
    input.city ? `Ort: ${input.city}` : "",
    "",
    "Öppna Bokningar i Proffera för att bekräfta eller avboka förfrågan.",
  ].filter(Boolean).join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #17201a;">
      <p>Hej ${escapeHtml(input.companyName)},</p>
      <p>En ny bokningsförfrågan har kommit in via Proffera.</p>
      <ul>
        <li><strong>Kund:</strong> ${escapeHtml(input.customerName)}</li>
        ${input.customerEmail ? `<li><strong>E-post:</strong> ${escapeHtml(input.customerEmail)}</li>` : ""}
        ${input.customerPhone ? `<li><strong>Telefon:</strong> ${escapeHtml(input.customerPhone)}</li>` : ""}
        <li><strong>Tjänst:</strong> ${escapeHtml(input.service)}</li>
        <li><strong>Start:</strong> ${escapeHtml(start)}</li>
        <li><strong>Slut:</strong> ${escapeHtml(end)}</li>
        ${input.city ? `<li><strong>Ort:</strong> ${escapeHtml(input.city)}</li>` : ""}
      </ul>
      <p>Öppna Bokningar i Proffera för att bekräfta eller avboka förfrågan.</p>
    </div>
  `;

  return { subject, text, html };
}

export function buildBookingStatusEmail(input: SendBookingStatusEmailInput) {
  const start = formatBookingTime(input.startsAt, input.timeZone);
  const end = formatBookingTime(input.endsAt, input.timeZone);
  const isConfirmed = input.status === "confirmed";
  const subject = isConfirmed
    ? `Din bokning är bekräftad – ${input.companyName}`
    : `Din bokning är avbokad – ${input.companyName}`;
  const statusText = isConfirmed
    ? `Din bokning hos ${input.companyName} är bekräftad.`
    : `Din bokning hos ${input.companyName} är avbokad.`;
  const nextStep = isConfirmed
    ? "Hör av dig till företaget om du behöver ändra tiden."
    : "Hör av dig till företaget om du vill boka en ny tid.";
  const text = [
    `Hej ${input.customerName},`,
    "",
    statusText,
    "",
    `Tjänst: ${input.service}`,
    `Start: ${start}`,
    `Slut: ${end}`,
    input.city ? `Ort: ${input.city}` : "",
    "",
    nextStep,
    "",
    "Med vänliga hälsningar",
    input.companyName,
  ].filter(Boolean).join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #17201a;">
      <p>Hej ${escapeHtml(input.customerName)},</p>
      <p>${escapeHtml(statusText)}</p>
      <ul>
        <li><strong>Tjänst:</strong> ${escapeHtml(input.service)}</li>
        <li><strong>Start:</strong> ${escapeHtml(start)}</li>
        <li><strong>Slut:</strong> ${escapeHtml(end)}</li>
        ${input.city ? `<li><strong>Ort:</strong> ${escapeHtml(input.city)}</li>` : ""}
      </ul>
      <p>${escapeHtml(nextStep)}</p>
      <p>Med vänliga hälsningar<br />${escapeHtml(input.companyName)}</p>
    </div>
  `;

  return { subject, text, html };
}

export function buildWorkspaceInvitationEmail(input: SendWorkspaceInvitationEmailInput) {
  const subject = `Aktivera ${input.companyName} i Proffera`;
  const text = [
    `Hej ${input.contactName},`,
    "",
    `${input.companyName} har godkänts för Proffera.`,
    "Öppna länken och välj ditt lösenord för att aktivera kundportalen:",
    input.activationUrl,
    "",
    `Länken gäller i ${input.expiresInHours} timmar och kan bara användas en gång.`,
    "",
    "Med vänliga hälsningar",
    "Proffera",
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #17201a;">
      <p>Hej ${escapeHtml(input.contactName)},</p>
      <p><strong>${escapeHtml(input.companyName)}</strong> har godkänts för Proffera.</p>
      <p>Öppna länken och välj ditt lösenord för att aktivera kundportalen.</p>
      <p style="margin: 28px 0;">
        <a href="${escapeHtml(input.activationUrl)}" style="display: inline-block; border-radius: 12px; background: #17452f; color: #ffffff; padding: 14px 22px; text-decoration: none; font-weight: 700;">Aktivera kundportalen</a>
      </p>
      <p>Länken gäller i ${input.expiresInHours} timmar och kan bara användas en gång.</p>
      <p>Med vänliga hälsningar<br />Proffera</p>
    </div>
  `;

  return { subject, text, html };
}

export function buildWorkspaceMemberInvitationEmail(input: SendWorkspaceMemberInvitationEmailInput) {
  const subject = `Du är inbjuden till ${input.companyName} i Proffera`;
  const text = [`Hej ${input.contactName},`, "", `Du har bjudits in till ${input.companyName} i Proffera.`, "Öppna länken och välj ett lösenord:", input.activationUrl, "", `Länken gäller i ${input.expiresInHours} timmar och kan bara användas en gång.`, "", "Med vänliga hälsningar", "Proffera"].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;"><p>Hej ${escapeHtml(input.contactName)},</p><p>Du har bjudits in till <strong>${escapeHtml(input.companyName)}</strong> i Proffera.</p><p style="margin:28px 0;"><a href="${escapeHtml(input.activationUrl)}" style="display:inline-block;border-radius:12px;background:#17452f;color:#fff;padding:14px 22px;text-decoration:none;font-weight:700;">Skapa konto och öppna arbetsytan</a></p><p>Länken gäller i ${input.expiresInHours} timmar och kan bara användas en gång.</p><p>Med vänliga hälsningar<br />Proffera</p></div>`;
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

export async function sendBookingOwnerNotificationEmail(input: SendBookingOwnerNotificationEmailInput) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false as const, message: "Brevo är inte konfigurerat." };

  const sender = parseSender(from);
  const email = buildBookingOwnerNotificationEmail(input);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender,
        to: [{ email: input.ownerEmail, name: input.companyName }],
        subject: email.subject,
        textContent: email.text,
        htmlContent: email.html,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as BrevoResponse;
    if (!response.ok) return { ok: false as const, message: data.message ?? data.code ?? "Kunde inte skicka bokningsnotis." };
    return { ok: true as const, providerId: data.messageId ?? null };
  } catch {
    return { ok: false as const, message: "Kunde inte kontakta Brevo." };
  }
}

export async function sendBookingStatusEmail(input: SendBookingStatusEmailInput) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false as const, message: "Brevo är inte konfigurerat." };

  const sender = parseSender(from);
  const email = buildBookingStatusEmail(input);

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
    if (!response.ok) return { ok: false as const, message: data.message ?? data.code ?? "Kunde inte skicka statusmejl." };
    return { ok: true as const, providerId: data.messageId ?? null };
  } catch {
    return { ok: false as const, message: "Kunde inte kontakta Brevo." };
  }
}

export async function sendWorkspaceInvitationEmail(input: SendWorkspaceInvitationEmailInput) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false as const, code: "configuration" as const, message: "Brevo är inte konfigurerat." };

  const sender = parseSender(from);
  const email = buildWorkspaceInvitationEmail(input);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender,
        to: [{ email: input.email, name: input.contactName }],
        subject: email.subject,
        textContent: email.text,
        htmlContent: email.html,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as BrevoResponse;
    if (!response.ok) return { ok: false as const, code: "provider" as const, message: data.message ?? data.code ?? "Kunde inte skicka inbjudan." };
    return { ok: true as const, providerId: data.messageId ?? null };
  } catch {
    return { ok: false as const, code: "network" as const, message: "Kunde inte kontakta Brevo." };
  }
}

export async function sendWorkspaceMemberInvitationEmail(input: SendWorkspaceMemberInvitationEmailInput) {
  const apiKey = process.env.BREVO_API_KEY, from = process.env.LEAD_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false as const, code: "configuration" as const, message: "Brevo är inte konfigurerat." };
  const sender = parseSender(from), email = buildWorkspaceMemberInvitationEmail(input);
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ sender, to: [{ email: input.email, name: input.contactName }], subject: email.subject, textContent: email.text, htmlContent: email.html }) });
    const data = (await response.json().catch(() => ({}))) as BrevoResponse;
    return response.ok ? { ok: true as const, providerId: data.messageId ?? null } : { ok: false as const, code: "provider" as const, message: data.message ?? "Kunde inte skicka inbjudan." };
  } catch { return { ok: false as const, code: "network" as const, message: "Kunde inte kontakta Brevo." }; }
}

export async function sendPrimeViewQuoteEmails(input: SendPrimeViewQuoteEmailsInput) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;

  if (!apiKey || !from) {
    return { ok: false as const, message: "Brevo is not configured." };
  }

  const sender = parseSender(from);
  const ownerEmail = buildPrimeViewQuoteOwnerEmail(input.quote);

  try {
    const ownerResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender,
        to: [{ email: input.recipient.email, name: input.recipient.name }],
        replyTo: { email: input.quote.email, name: input.quote.name },
        subject: ownerEmail.subject,
        textContent: ownerEmail.text,
        htmlContent: ownerEmail.html,
      }),
    });
    const ownerData = (await ownerResponse.json().catch(() => ({}))) as BrevoResponse;

    if (!ownerResponse.ok) {
      return { ok: false as const, message: ownerData.message ?? ownerData.code ?? "Brevo rejected the PrimeView quote notification." };
    }

    const confirmationEmail = buildPrimeViewQuoteConfirmationEmail(input.quote);

    try {
      const confirmationResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          sender,
          to: [{ email: input.quote.email, name: input.quote.name }],
          replyTo: { email: input.recipient.email, name: input.recipient.name },
          subject: confirmationEmail.subject,
          textContent: confirmationEmail.text,
          htmlContent: confirmationEmail.html,
        }),
      });
      const confirmationData = (await confirmationResponse.json().catch(() => ({}))) as BrevoResponse;

      if (!confirmationResponse.ok) {
        return {
          ok: true as const,
          confirmationSent: false as const,
          confirmationError: confirmationData.message ?? confirmationData.code ?? "Brevo rejected the customer confirmation.",
          providerId: ownerData.messageId ?? null,
        };
      }

      return {
        ok: true as const,
        confirmationSent: true as const,
        providerId: ownerData.messageId ?? null,
        confirmationProviderId: confirmationData.messageId ?? null,
      };
    } catch {
      return {
        ok: true as const,
        confirmationSent: false as const,
        confirmationError: "Could not contact Brevo for the customer confirmation.",
        providerId: ownerData.messageId ?? null,
      };
    }
  } catch {
    return { ok: false as const, message: "Could not contact Brevo." };
  }
}
