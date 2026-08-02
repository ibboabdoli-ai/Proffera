import type { WorkspaceTimeZone } from "@/lib/workspace-market";

type Input = { customerName: string; customerEmail: string; companyName: string; service: string; startsAt: string; city: string; timeZone?: WorkspaceTimeZone };

type BrevoResponse = { messageId?: string; message?: string; code?: string };

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function parseSender(value: string) {
  const match = value.match(/^(.+?)\s*<([^>]+)>$/);
  return match ? { name: match[1].trim(), email: match[2].trim() } : { name: "Proffera", email: value.trim() };
}

function formatDate(value: string, timeZone: WorkspaceTimeZone = "Europe/Stockholm") {
  return new Intl.DateTimeFormat("sv-SE", { timeZone, dateStyle: "full", timeStyle: "short" }).format(new Date(value));
}

export async function sendBookingReminderEmail(input: Input) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false as const, skipped: true as const, message: "Brevo är inte konfigurerat." };
  const when = formatDate(input.startsAt, input.timeZone);
  const subject = `Påminnelse om din bokning – ${input.companyName}`;
  const text = [`Hej ${input.customerName},`, "", `Detta är en påminnelse om din bokning hos ${input.companyName}.`, `Tid: ${when}`, `Tjänst: ${input.service}`, input.city ? `Ort: ${input.city}` : "", "", "Kontakta företaget om du behöver ändra tiden."].filter(Boolean).join("\n");
  const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a"><p>Hej ${escapeHtml(input.customerName)},</p><p>Detta är en påminnelse om din bokning hos <strong>${escapeHtml(input.companyName)}</strong>.</p><ul><li><strong>Tid:</strong> ${escapeHtml(when)}</li><li><strong>Tjänst:</strong> ${escapeHtml(input.service)}</li>${input.city ? `<li><strong>Ort:</strong> ${escapeHtml(input.city)}</li>` : ""}</ul><p>Kontakta företaget om du behöver ändra tiden.</p></div>`;
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", { method: "POST", headers: { "api-key": apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ sender: parseSender(from), to: [{ email: input.customerEmail, name: input.customerName }], subject, textContent: text, htmlContent: html }) });
    const data = (await response.json().catch(() => ({}))) as BrevoResponse;
    if (!response.ok) return { ok: false as const, skipped: false as const, message: data.message ?? data.code ?? "Kunde inte skicka påminnelsemejl." };
    return { ok: true as const, skipped: false as const, providerId: data.messageId ?? null };
  } catch {
    return { ok: false as const, skipped: false as const, message: "Kunde inte kontakta Brevo." };
  }
}
