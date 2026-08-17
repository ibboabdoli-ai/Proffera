import type { WorkspaceTimeZone } from "@/lib/workspace-market";

type SendBookingOwnerSmsInput = {
  ownerPhone: string;
  companyName: string;
  customerName: string;
  customerPhone: string;
  service: string;
  startsAt: string;
  timeZone?: WorkspaceTimeZone;
};

type SendBookingCustomerSmsInput = {
  customerPhone: string;
  companyName: string;
  status: "confirmed" | "cancelled" | "rescheduled";
  service: string;
  startsAt: string;
  previousStartsAt?: string;
  timeZone?: WorkspaceTimeZone;
};

type SendBookingVerificationSmsInput = {
  customerPhone: string;
  companyName: string;
  code: string;
  expiresMinutes?: number;
  language?: "sv" | "en";
};

type BrevoSmsResponse = {
  messageId?: number;
  code?: string;
  message?: string;
};

function normalizeInternationalPhone(value: string) {
  const compact = value.replace(/[^\d+]/g, "");
  if (/^\+[1-9]\d{6,14}$/.test(compact)) return compact;
  if (/^00[1-9]\d{6,14}$/.test(compact)) return `+${compact.slice(2)}`;
  // Keep local Swedish entry convenient for the existing Swedish businesses.
  if (/^0\d{7,12}$/.test(compact)) return `+46${compact.slice(1)}`;
  return null;
}

function formatBookingDate(value: string, timeZone: WorkspaceTimeZone = "Europe/Stockholm") {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function previewSmsBlocked() {
  return process.env.VERCEL_ENV === "preview";
}

export async function sendBookingVerificationSms(input: SendBookingVerificationSmsInput) {
  if (previewSmsBlocked()) {
    return { ok: false as const, skipped: true as const, message: "SMS is disabled in Vercel Preview." };
  }

  const apiKey = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SMS_SENDER?.trim();
  if (!apiKey || !sender) {
    return { ok: false as const, skipped: true as const, message: "Brevo SMS is not enabled." };
  }

  const recipient = normalizeInternationalPhone(input.customerPhone);
  if (!recipient) {
    return { ok: false as const, skipped: true as const, message: "Customer phone number is invalid." };
  }

  const expiresMinutes = input.expiresMinutes ?? 10;
  const content = input.language === "en"
    ? `${input.code} is your ${input.companyName} booking verification code. Valid for ${expiresMinutes} minutes.`
    : `${input.code} är din verifieringskod för bokningen hos ${input.companyName}. Gäller i ${expiresMinutes} minuter.`;

  try {
    const response = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ sender: sender.slice(0, 11), recipient, content, type: "transactional" }),
    });
    const data = (await response.json().catch(() => ({}))) as BrevoSmsResponse;
    if (!response.ok) {
      return { ok: false as const, skipped: false as const, message: data.message ?? data.code ?? "Could not send verification SMS via Brevo." };
    }
    return { ok: true as const, skipped: false as const, providerId: data.messageId ?? null };
  } catch {
    return { ok: false as const, skipped: false as const, message: "Could not contact Brevo SMS." };
  }
}

export async function sendBookingOwnerSms(input: SendBookingOwnerSmsInput) {
  if (previewSmsBlocked()) {
    return { ok: false as const, skipped: true as const, message: "SMS is disabled in Vercel Preview." };
  }

  const apiKey = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SMS_SENDER?.trim();
  if (!apiKey || !sender) {
    return { ok: false as const, skipped: true as const, message: "Brevo SMS är inte aktiverat." };
  }

  const recipient = normalizeInternationalPhone(input.ownerPhone);
  if (!recipient) {
    return { ok: false as const, skipped: true as const, message: "Kontakttelefonen är ogiltig." };
  }

  const customerPhone = input.customerPhone.trim() || "telefon saknas";
  const content = `Ny bokning hos ${input.companyName}. Kund: ${input.customerName}, tel: ${customerPhone}. ${input.service}, ${formatBookingDate(input.startsAt, input.timeZone)}. Öppna Proffera.`;

  try {
    const response = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ sender: sender.slice(0, 11), recipient, content, type: "transactional" }),
    });
    const data = (await response.json().catch(() => ({}))) as BrevoSmsResponse;
    if (!response.ok) {
      return { ok: false as const, skipped: false as const, message: data.message ?? data.code ?? "Kunde inte skicka SMS via Brevo." };
    }
    return { ok: true as const, skipped: false as const, providerId: data.messageId ?? null };
  } catch {
    return { ok: false as const, skipped: false as const, message: "Kunde inte kontakta Brevo SMS." };
  }
}

export async function sendBookingCustomerSms(input: SendBookingCustomerSmsInput) {
  if (previewSmsBlocked()) {
    return { ok: false as const, skipped: true as const, message: "SMS is disabled in Vercel Preview." };
  }

  const apiKey = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SMS_SENDER?.trim();
  if (!apiKey || !sender) {
    return { ok: false as const, skipped: true as const, message: "Brevo SMS är inte aktiverat." };
  }

  const recipient = normalizeInternationalPhone(input.customerPhone);
  if (!recipient) {
    return { ok: false as const, skipped: true as const, message: "Kundens telefonnummer är ogiltigt." };
  }

  let content: string;
  if (input.status === "confirmed") {
    content = `Din bokning hos ${input.companyName} är bekräftad: ${input.service}, ${formatBookingDate(input.startsAt, input.timeZone)}.`;
  } else if (input.status === "cancelled") {
    content = `Din bokning hos ${input.companyName} är avbokad: ${input.service}, ${formatBookingDate(input.startsAt, input.timeZone)}. Kontakta företaget för ny tid.`;
  } else {
    const previous = input.previousStartsAt ? ` från ${formatBookingDate(input.previousStartsAt, input.timeZone)}` : "";
    content = `Din bokning hos ${input.companyName} har flyttats${previous} till ${formatBookingDate(input.startsAt, input.timeZone)}: ${input.service}.`;
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ sender: sender.slice(0, 11), recipient, content, type: "transactional" }),
    });
    const data = (await response.json().catch(() => ({}))) as BrevoSmsResponse;
    if (!response.ok) {
      return { ok: false as const, skipped: false as const, message: data.message ?? data.code ?? "Kunde inte skicka SMS via Brevo." };
    }
    return { ok: true as const, skipped: false as const, providerId: data.messageId ?? null };
  } catch {
    return { ok: false as const, skipped: false as const, message: "Kunde inte kontakta Brevo SMS." };
  }
}
