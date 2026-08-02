import type { WorkspaceTimeZone } from "@/lib/workspace-market";

type Input = { customerPhone: string; companyName: string; service: string; startsAt: string; timeZone?: WorkspaceTimeZone };

type BrevoSmsResponse = { messageId?: number; code?: string; message?: string };

function normalizeInternationalPhone(value: string) {
  const compact = value.replace(/[^\d+]/g, "");
  if (/^\+[1-9]\d{6,14}$/.test(compact)) return compact;
  if (/^00[1-9]\d{6,14}$/.test(compact)) return `+${compact.slice(2)}`;
  if (/^0\d{7,12}$/.test(compact)) return `+46${compact.slice(1)}`;
  return null;
}

function formatDate(value: string, timeZone: WorkspaceTimeZone = "Europe/Stockholm") {
  return new Intl.DateTimeFormat("sv-SE", { timeZone, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export async function sendBookingReminderSms(input: Input) {
  const apiKey = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SMS_SENDER?.trim();
  if (!apiKey || !sender) return { ok: false as const, skipped: true as const, message: "Brevo SMS är inte aktiverat." };
  const recipient = normalizeInternationalPhone(input.customerPhone);
  if (!recipient) return { ok: false as const, skipped: true as const, message: "Kundens telefonnummer är ogiltigt." };
  const content = `Påminnelse: du har en bokning hos ${input.companyName}, ${input.service}, ${formatDate(input.startsAt, input.timeZone)}.`;
  try {
    const response = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", { method: "POST", headers: { "api-key": apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ sender: sender.slice(0, 11), recipient, content, type: "transactional" }) });
    const data = (await response.json().catch(() => ({}))) as BrevoSmsResponse;
    if (!response.ok) return { ok: false as const, skipped: false as const, message: data.message ?? data.code ?? "Kunde inte skicka påminnelse-SMS." };
    return { ok: true as const, skipped: false as const, providerId: data.messageId ? String(data.messageId) : null };
  } catch {
    return { ok: false as const, skipped: false as const, message: "Kunde inte kontakta Brevo SMS." };
  }
}
