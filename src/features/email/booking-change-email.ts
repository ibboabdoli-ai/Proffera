import "server-only";

import type { WorkspaceTimeZone } from "@/lib/workspace-market";

type BookingChangeEmailInput = {
  kind: "cancelled" | "rescheduled";
  customerName: string;
  customerEmail: string;
  ownerEmail?: string;
  companyName: string;
  service: string;
  city?: string;
  oldStartsAt: string;
  oldEndsAt: string;
  newStartsAt?: string;
  newEndsAt?: string;
  portalUrl: string;
  timeZone: WorkspaceTimeZone;
};

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function formatTime(value: string, timeZone: WorkspaceTimeZone, language: "sv" | "en") {
  return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "sv-SE", { timeZone, dateStyle: "full", timeStyle: "short" }).format(new Date(value));
}

function parseSender(value: string) {
  const match = value.match(/^(.+?)\s*<([^>]+)>$/);
  return match ? { name: match[1].trim(), email: match[2].trim() } : { name: "Proffera", email: value.trim() };
}

async function send(to: { email: string; name: string }, subject: string, text: string, html: string) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;
  if (!apiKey || !from) return { ok: false as const, message: "Brevo är inte konfigurerat." };
  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ sender: parseSender(from), to: [to], subject, textContent: text, htmlContent: html }),
    });
    const data = (await response.json().catch(() => ({}))) as { messageId?: string; message?: string };
    return response.ok ? { ok: true as const, providerId: data.messageId ?? null } : { ok: false as const, message: data.message ?? "Kunde inte skicka mejl." };
  } catch {
    return { ok: false as const, message: "Kunde inte kontakta Brevo." };
  }
}

export async function sendBookingChangeEmails(input: BookingChangeEmailInput) {
  const language: "sv" | "en" = input.companyName.trim().toLowerCase() === "primeview window care" ? "en" : "sv";
  const isEnglish = language === "en";
  const oldTime = `${formatTime(input.oldStartsAt, input.timeZone, language)}–${formatTime(input.oldEndsAt, input.timeZone, language)}`;
  const newTime = input.newStartsAt && input.newEndsAt ? `${formatTime(input.newStartsAt, input.timeZone, language)}–${formatTime(input.newEndsAt, input.timeZone, language)}` : null;
  const changed = input.kind === "rescheduled";

  const customerSubject = isEnglish
    ? changed ? `Your booking has been rescheduled – ${input.companyName}` : `Your booking has been cancelled – ${input.companyName}`
    : changed ? `Din bokningstid har ändrats – ${input.companyName}` : `Din bokning är avbokad – ${input.companyName}`;

  const customerText = isEnglish
    ? [
        `Hello ${input.customerName},`, "",
        changed ? `Your booking with ${input.companyName} has been rescheduled.` : `Your booking with ${input.companyName} has been cancelled.`,
        `Service: ${input.service}`, `Previous time: ${oldTime}`, newTime ? `New time: ${newTime}` : "", input.city ? `Location: ${input.city}` : "", "",
        `Manage your bookings: ${input.portalUrl}`,
      ].filter(Boolean).join("\n")
    : [
        `Hej ${input.customerName},`, "",
        changed ? `Din bokning hos ${input.companyName} har flyttats.` : `Din bokning hos ${input.companyName} har avbokats.`,
        `Tjänst: ${input.service}`, `Tidigare tid: ${oldTime}`, newTime ? `Ny tid: ${newTime}` : "", input.city ? `Ort: ${input.city}` : "", "",
        `Hantera dina bokningar: ${input.portalUrl}`,
      ].filter(Boolean).join("\n");

  const customerHtml = isEnglish
    ? `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a"><p>Hello ${escapeHtml(input.customerName)},</p><p>${changed ? `Your booking with <strong>${escapeHtml(input.companyName)}</strong> has been rescheduled.` : `Your booking with <strong>${escapeHtml(input.companyName)}</strong> has been cancelled.`}</p><ul><li><strong>Service:</strong> ${escapeHtml(input.service)}</li><li><strong>Previous time:</strong> ${escapeHtml(oldTime)}</li>${newTime ? `<li><strong>New time:</strong> ${escapeHtml(newTime)}</li>` : ""}${input.city ? `<li><strong>Location:</strong> ${escapeHtml(input.city)}</li>` : ""}</ul><p><a href="${escapeHtml(input.portalUrl)}" style="display:inline-block;border-radius:12px;background:#17452f;color:#fff;padding:13px 20px;text-decoration:none;font-weight:700">Manage bookings</a></p><p>Kind regards<br>${escapeHtml(input.companyName)}</p></div>`
    : `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a"><p>Hej ${escapeHtml(input.customerName)},</p><p>${changed ? `Din bokning hos <strong>${escapeHtml(input.companyName)}</strong> har flyttats.` : `Din bokning hos <strong>${escapeHtml(input.companyName)}</strong> har avbokats.`}</p><ul><li><strong>Tjänst:</strong> ${escapeHtml(input.service)}</li><li><strong>Tidigare tid:</strong> ${escapeHtml(oldTime)}</li>${newTime ? `<li><strong>Ny tid:</strong> ${escapeHtml(newTime)}</li>` : ""}${input.city ? `<li><strong>Ort:</strong> ${escapeHtml(input.city)}</li>` : ""}</ul><p><a href="${escapeHtml(input.portalUrl)}" style="display:inline-block;border-radius:12px;background:#17452f;color:#fff;padding:13px 20px;text-decoration:none;font-weight:700">Hantera bokningar</a></p><p>Med vänliga hälsningar<br>${escapeHtml(input.companyName)}</p></div>`;

  const jobs: Promise<unknown>[] = [send({ email: input.customerEmail, name: input.customerName }, customerSubject, customerText, customerHtml)];
  if (input.ownerEmail) {
    const ownerSubject = isEnglish
      ? changed ? `Customer rescheduled – ${input.service}` : `Customer cancelled – ${input.service}`
      : changed ? `Kunden har bokat om – ${input.service}` : `Kunden har avbokat – ${input.service}`;
    const ownerText = isEnglish
      ? [`Customer: ${input.customerName}`, `Email: ${input.customerEmail}`, `Service: ${input.service}`, `Previous time: ${oldTime}`, newTime ? `New time: ${newTime}` : "", input.city ? `Location: ${input.city}` : ""].filter(Boolean).join("\n")
      : [`Kund: ${input.customerName}`, `E-post: ${input.customerEmail}`, `Tjänst: ${input.service}`, `Tidigare tid: ${oldTime}`, newTime ? `Ny tid: ${newTime}` : "", input.city ? `Ort: ${input.city}` : ""].filter(Boolean).join("\n");
    const ownerHtml = isEnglish
      ? `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a"><h2>${escapeHtml(ownerSubject)}</h2><ul><li><strong>Customer:</strong> ${escapeHtml(input.customerName)}</li><li><strong>Email:</strong> ${escapeHtml(input.customerEmail)}</li><li><strong>Service:</strong> ${escapeHtml(input.service)}</li><li><strong>Previous time:</strong> ${escapeHtml(oldTime)}</li>${newTime ? `<li><strong>New time:</strong> ${escapeHtml(newTime)}</li>` : ""}${input.city ? `<li><strong>Location:</strong> ${escapeHtml(input.city)}</li>` : ""}</ul><p>Open Proffera to manage the booking.</p></div>`
      : `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a"><h2>${escapeHtml(ownerSubject)}</h2><ul><li><strong>Kund:</strong> ${escapeHtml(input.customerName)}</li><li><strong>E-post:</strong> ${escapeHtml(input.customerEmail)}</li><li><strong>Tjänst:</strong> ${escapeHtml(input.service)}</li><li><strong>Tidigare tid:</strong> ${escapeHtml(oldTime)}</li>${newTime ? `<li><strong>Ny tid:</strong> ${escapeHtml(newTime)}</li>` : ""}${input.city ? `<li><strong>Ort:</strong> ${escapeHtml(input.city)}</li>` : ""}</ul><p>Öppna Proffera för att hantera bokningen.</p></div>`;
    jobs.push(send({ email: input.ownerEmail, name: input.companyName }, ownerSubject, ownerText, ownerHtml));
  }
  return Promise.allSettled(jobs);
}
