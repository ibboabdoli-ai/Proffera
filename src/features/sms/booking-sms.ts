type SendBookingOwnerSmsInput = {
  ownerPhone: string;
  companyName: string;
  customerName: string;
  customerPhone: string;
  service: string;
  startsAt: string;
};

type SendBookingCustomerSmsInput = {
  customerPhone: string;
  companyName: string;
  status: "confirmed" | "cancelled";
  service: string;
  startsAt: string;
};

type BrevoSmsResponse = {
  messageId?: number;
  code?: string;
  message?: string;
};

function normalizeSwedishPhone(value: string) {
  const compact = value.replace(/[^\d+]/g, "");
  if (/^\+46\d{7,12}$/.test(compact)) return compact;
  if (/^0046\d{7,12}$/.test(compact)) return `+${compact.slice(2)}`;
  if (/^0\d{7,12}$/.test(compact)) return `+46${compact.slice(1)}`;
  return null;
}

function formatStockholmDate(value: string) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export async function sendBookingOwnerSms(input: SendBookingOwnerSmsInput) {
  const apiKey = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SMS_SENDER?.trim();
  if (!apiKey || !sender) {
    return { ok: false as const, skipped: true as const, message: "Brevo SMS är inte aktiverat." };
  }

  const recipient = normalizeSwedishPhone(input.ownerPhone);
  if (!recipient) {
    return { ok: false as const, skipped: true as const, message: "Kontakttelefonen är ogiltig." };
  }

  const customerPhone = input.customerPhone.trim() || "telefon saknas";
  const content = `Ny bokning hos ${input.companyName}. Kund: ${input.customerName}, tel: ${customerPhone}. ${input.service}, ${formatStockholmDate(input.startsAt)}. Öppna Proffera.`;

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
  const apiKey = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SMS_SENDER?.trim();
  if (!apiKey || !sender) {
    return { ok: false as const, skipped: true as const, message: "Brevo SMS är inte aktiverat." };
  }

  const recipient = normalizeSwedishPhone(input.customerPhone);
  if (!recipient) {
    return { ok: false as const, skipped: true as const, message: "Kundens telefonnummer är ogiltigt." };
  }

  const isConfirmed = input.status === "confirmed";
  const content = isConfirmed
    ? `Din bokning hos ${input.companyName} är bekräftad: ${input.service}, ${formatStockholmDate(input.startsAt)}.`
    : `Din bokning hos ${input.companyName} är avbokad: ${input.service}, ${formatStockholmDate(input.startsAt)}. Kontakta företaget för ny tid.`;

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
