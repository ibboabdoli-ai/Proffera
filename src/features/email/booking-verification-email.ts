type BookingVerificationEmailInput = {
  customerName: string;
  customerEmail: string;
  companyName: string;
  code: string;
  expiresMinutes?: number;
  language?: "sv" | "en";
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
  const isEnglish = input.language === "en";
  const subject = isEnglish ? `${input.code} is your verification code for ${input.companyName}` : `${input.code} är din verifieringskod för ${input.companyName}`;
  const text = isEnglish ? [
    `${input.code} is your verification code.`, "", `Use this code to verify your booking with ${input.companyName}.`, `The code is valid for ${expiresMinutes} minutes.`, "", `Hi ${input.customerName},`, "Your booking is created only after the code is verified.", "If you did not make this booking, you can ignore this email.",
  ].join("\n") : [
    `${input.code} är din verifieringskod.`, "", `Använd koden för att verifiera din bokning hos ${input.companyName}.`, `Koden gäller i ${expiresMinutes} minuter.`, "", `Hej ${input.customerName},`, "Bokningen skapas först när koden har verifierats.", "Om du inte gjorde bokningen kan du ignorera mejlet.",
  ].join("\n");
  const html = isEnglish ? `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;max-width:620px;margin:0 auto">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(input.code)} is your verification code for ${escapeHtml(input.companyName)}.</div>
      <p style="font-size:14px;color:#667168;margin:0 0 8px">Verification code</p>
      <p style="font-size:40px;font-weight:800;letter-spacing:10px;margin:0 0 24px;color:#17452f">${escapeHtml(input.code)}</p>
      <p>Hi ${escapeHtml(input.customerName)},</p>
      <p>Use the code above to verify your booking with <strong>${escapeHtml(input.companyName)}</strong>.</p>
      <p>The code is valid for ${expiresMinutes} minutes. Your booking is created only after the code is verified.</p>
      <p style="font-size:13px;color:#667168">If you did not make this booking, you can ignore this email.</p>
    </div>
  ` : `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#17201a;max-width:620px;margin:0 auto">
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(input.code)} är din verifieringskod för ${escapeHtml(input.companyName)}.</div>
      <p style="font-size:14px;color:#667168;margin:0 0 8px">Verifieringskod</p>
      <p style="font-size:40px;font-weight:800;letter-spacing:10px;margin:0 0 24px;color:#17452f">${escapeHtml(input.code)}</p>
      <p>Hej ${escapeHtml(input.customerName)},</p>
      <p>Använd koden ovan för att verifiera din bokning hos <strong>${escapeHtml(input.companyName)}</strong>.</p>
      <p>Koden gäller i ${expiresMinutes} minuter. Bokningen skapas först när koden har verifierats.</p>
      <p style="font-size:13px;color:#667168">Om du inte gjorde bokningen kan du ignorera mejlet.</p>
    </div>
  `;

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
