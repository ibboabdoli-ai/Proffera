import "server-only";

import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";

export type CompanyDirectoryClaimEmailEvidence = {
  version: 1;
  stage: "business_email_code_sent" | "business_email_verified" | "business_email_locked";
  claimantName: string;
  role: string;
  businessEmail: string;
  phone: string;
  accountEmail: string;
  emailDomainKind: "business_domain" | "public_mailbox";
  codeSalt?: string;
  codeHash?: string;
  codeExpiresAt?: string;
  codeAttempts: number;
  codeSentAt: string;
  businessEmailVerifiedAt?: string;
  providerId?: string | null;
  adminReference?: string;
  adminReviewedAt?: string;
};

type BrevoResponse = {
  messageId?: string;
  message?: string;
  code?: string;
};

const PUBLIC_MAILBOX_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "hotmail.se",
  "outlook.com",
  "outlook.se",
  "live.com",
  "live.se",
  "msn.com",
  "yahoo.com",
  "yahoo.se",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "mail.com",
]);

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseSender(raw: string) {
  const match = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1]?.trim() || "Proffera", email: match[2]?.trim() || "" };
  return { name: "Proffera", email: raw.trim() };
}

export function validBusinessEmail(value: string) {
  return value.length >= 5
    && value.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function businessEmailDomainKind(email: string): "business_domain" | "public_mailbox" {
  const domain = email.trim().toLowerCase().split("@").pop() ?? "";
  return PUBLIC_MAILBOX_DOMAINS.has(domain) ? "public_mailbox" : "business_domain";
}

export function parseClaimEmailEvidence(value: unknown): CompanyDirectoryClaimEmailEvidence | null {
  const raw = String(value ?? "").trim();
  if (!raw.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CompanyDirectoryClaimEmailEvidence>;
    if (parsed.version !== 1) return null;
    if (!["business_email_code_sent", "business_email_verified", "business_email_locked"].includes(String(parsed.stage))) return null;
    if (!validBusinessEmail(String(parsed.businessEmail ?? ""))) return null;
    if (!String(parsed.claimantName ?? "").trim() || !String(parsed.role ?? "").trim()) return null;
    return {
      version: 1,
      stage: parsed.stage as CompanyDirectoryClaimEmailEvidence["stage"],
      claimantName: String(parsed.claimantName ?? "").trim(),
      role: String(parsed.role ?? "").trim(),
      businessEmail: String(parsed.businessEmail ?? "").trim().toLowerCase(),
      phone: String(parsed.phone ?? "").trim(),
      accountEmail: String(parsed.accountEmail ?? "").trim().toLowerCase(),
      emailDomainKind: parsed.emailDomainKind === "public_mailbox" ? "public_mailbox" : "business_domain",
      codeSalt: parsed.codeSalt ? String(parsed.codeSalt) : undefined,
      codeHash: parsed.codeHash ? String(parsed.codeHash) : undefined,
      codeExpiresAt: parsed.codeExpiresAt ? String(parsed.codeExpiresAt) : undefined,
      codeAttempts: Number.isFinite(Number(parsed.codeAttempts)) ? Math.max(0, Number(parsed.codeAttempts)) : 0,
      codeSentAt: String(parsed.codeSentAt ?? ""),
      businessEmailVerifiedAt: parsed.businessEmailVerifiedAt ? String(parsed.businessEmailVerifiedAt) : undefined,
      providerId: parsed.providerId == null ? null : String(parsed.providerId),
      adminReference: parsed.adminReference ? String(parsed.adminReference) : undefined,
      adminReviewedAt: parsed.adminReviewedAt ? String(parsed.adminReviewedAt) : undefined,
    };
  } catch {
    return null;
  }
}

export function isClaimBusinessEmailVerified(evidence: CompanyDirectoryClaimEmailEvidence | null) {
  return Boolean(
    evidence
      && evidence.stage === "business_email_verified"
      && evidence.businessEmailVerifiedAt
      && validBusinessEmail(evidence.businessEmail),
  );
}

export function serializeClaimEmailEvidence(evidence: CompanyDirectoryClaimEmailEvidence) {
  return JSON.stringify(evidence);
}

export function createClaimEmailChallenge(input: {
  claimantName: string;
  role: string;
  businessEmail: string;
  phone: string;
  accountEmail: string;
}) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = randomBytes(16);
  const hash = scryptSync(code, salt, 32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
  const evidence: CompanyDirectoryClaimEmailEvidence = {
    version: 1,
    stage: "business_email_code_sent",
    claimantName: input.claimantName.trim(),
    role: input.role.trim(),
    businessEmail: input.businessEmail.trim().toLowerCase(),
    phone: input.phone.trim(),
    accountEmail: input.accountEmail.trim().toLowerCase(),
    emailDomainKind: businessEmailDomainKind(input.businessEmail),
    codeSalt: salt.toString("hex"),
    codeHash: hash.toString("hex"),
    codeExpiresAt: expiresAt.toISOString(),
    codeAttempts: 0,
    codeSentAt: now.toISOString(),
  };
  return { code, evidence };
}

export function checkClaimEmailCode(
  evidence: CompanyDirectoryClaimEmailEvidence,
  code: string,
): { ok: true; evidence: CompanyDirectoryClaimEmailEvidence } | { ok: false; reason: "expired" | "locked" | "invalid"; evidence: CompanyDirectoryClaimEmailEvidence } {
  if (evidence.stage === "business_email_locked" || evidence.codeAttempts >= 5) {
    return { ok: false, reason: "locked", evidence: { ...evidence, stage: "business_email_locked" } };
  }
  const expiresAt = evidence.codeExpiresAt ? new Date(evidence.codeExpiresAt) : null;
  if (!expiresAt || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired", evidence };
  }
  if (!/^\d{6}$/.test(code) || !evidence.codeSalt || !evidence.codeHash) {
    const attempts = evidence.codeAttempts + 1;
    return {
      ok: false,
      reason: attempts >= 5 ? "locked" : "invalid",
      evidence: { ...evidence, codeAttempts: attempts, stage: attempts >= 5 ? "business_email_locked" : evidence.stage },
    };
  }

  try {
    const actual = scryptSync(code, Buffer.from(evidence.codeSalt, "hex"), 32);
    const expected = Buffer.from(evidence.codeHash, "hex");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      const attempts = evidence.codeAttempts + 1;
      return {
        ok: false,
        reason: attempts >= 5 ? "locked" : "invalid",
        evidence: { ...evidence, codeAttempts: attempts, stage: attempts >= 5 ? "business_email_locked" : evidence.stage },
      };
    }
  } catch {
    const attempts = evidence.codeAttempts + 1;
    return {
      ok: false,
      reason: attempts >= 5 ? "locked" : "invalid",
      evidence: { ...evidence, codeAttempts: attempts, stage: attempts >= 5 ? "business_email_locked" : evidence.stage },
    };
  }

  const verifiedAt = new Date().toISOString();
  const verified: CompanyDirectoryClaimEmailEvidence = {
    ...evidence,
    stage: "business_email_verified",
    codeAttempts: evidence.codeAttempts,
    businessEmailVerifiedAt: verifiedAt,
  };
  delete verified.codeSalt;
  delete verified.codeHash;
  delete verified.codeExpiresAt;
  return { ok: true, evidence: verified };
}

export async function sendClaimBusinessEmailCode(input: {
  businessEmail: string;
  claimantName: string;
  companyName: string;
  code: string;
}) {
  const apiKey = process.env.BREVO_API_KEY;
  const from = process.env.LEAD_FROM_EMAIL;
  if (!apiKey || !from) {
    return { ok: false as const, code: "configuration", message: "Brevo is not configured." };
  }

  const sender = parseSender(from);
  const subject = `Verifieringskod för ${input.companyName} – Proffera`;
  const text = [
    `Hej ${input.claimantName},`,
    "",
    `Du har begärt att verifiera företagsmejlen för ${input.companyName} i Proffera.`,
    "",
    `Din verifieringskod är: ${input.code}`,
    "",
    "Koden gäller i 10 minuter och kan bara användas för den aktuella företagsprofilen.",
    "Om du inte gjorde denna begäran kan du ignorera mejlet.",
    "",
    "Proffera",
  ].join("\n");
  const html = `<!doctype html>
<html lang="sv">
  <body style="margin:0;padding:0;background:#f3f6f4;font-family:Arial,Helvetica,sans-serif;color:#17201a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;padding:24px 12px;background:#f3f6f4;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dfe7e1;">
          <tr><td style="padding:24px 28px;background:#173e2b;color:#ffffff;font-size:18px;font-weight:800;">Proffera</td></tr>
          <tr><td style="padding:30px 28px;">
            <p style="margin:0;color:#536057;font-size:15px;line-height:1.7;">Hej ${escapeHtml(input.claimantName)},</p>
            <h1 style="margin:14px 0 10px;font-size:24px;line-height:1.25;color:#17201a;">Verifiera företagsmejlen</h1>
            <p style="margin:0;color:#536057;font-size:15px;line-height:1.7;">Du verifierar din e-postadress för <strong>${escapeHtml(input.companyName)}</strong>.</p>
            <div style="margin:24px 0;border-radius:14px;background:#eef6f0;padding:20px;text-align:center;">
              <div style="font-size:12px;font-weight:800;letter-spacing:.12em;color:#5c7363;text-transform:uppercase;">Verifieringskod</div>
              <div style="margin-top:8px;font-size:34px;font-weight:900;letter-spacing:.18em;color:#173e2b;">${escapeHtml(input.code)}</div>
            </div>
            <p style="margin:0;color:#657068;font-size:13px;line-height:1.7;">Koden gäller i 10 minuter. Ett verifierat mejl ger inte automatiskt kontroll över företaget; Proffera granskar fortfarande anspråket innan en workspace kan skapas.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        sender,
        to: [{ email: input.businessEmail, name: input.claimantName }],
        subject,
        textContent: text,
        htmlContent: html,
      }),
    });
    const data = (await response.json().catch(() => ({}))) as BrevoResponse;
    if (!response.ok) {
      return { ok: false as const, code: "provider", message: data.message ?? data.code ?? "Brevo rejected the verification email." };
    }
    return { ok: true as const, providerId: data.messageId ?? null };
  } catch {
    return { ok: false as const, code: "network", message: "Could not contact Brevo." };
  }
}
