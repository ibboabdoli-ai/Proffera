import "server-only";

import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { marketplaceGuestInvitationEmailConfigured, sendMarketplaceGuestInvitationEmail } from "@/features/email/marketplace-guest-invitation-email";
import { resolveCustomerPortalSecret } from "@/lib/auth-secret";
import { getSql } from "@/lib/db/server";
import { isMarketplaceBusinessRecipientEmail, normalizeMarketplaceRecipientEmail } from "@/lib/marketplace-guest-quote";

const TEST_TOKEN_TTL_SECONDS = 60 * 60;
const TEST_TOKEN_PREFIX = "marketplace-guest-quote-test-v1";
const TEST_AUDIT_RESERVATION_ACTION = "marketplace.guest_quote_test_reserved";
const TEST_AUDIT_SENT_ACTION = "marketplace.guest_quote_test_sent";

type TestTokenPayload = {
  version: 1;
  exp: number;
  nonce: string;
};

export type MarketplaceGuestQuoteTestView = {
  expiresAt: string;
};

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function testTokenSecret() {
  return resolveCustomerPortalSecret();
}

function sign(encoded: string, secret: string) {
  return createHmac("sha256", secret).update(`${TEST_TOKEN_PREFIX}.${encoded}`).digest("base64url");
}

function recipientHash(email: string, secret: string) {
  return createHmac("sha256", secret)
    .update(`${TEST_TOKEN_PREFIX}.recipient.${email}`)
    .digest("hex");
}

function readTestToken(token: string): TestTokenPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [encoded, signature] = parts;
    const secret = testTokenSecret();
    if (!encoded || !signature || !secret || token.length > 800) return null;

    const actual = Buffer.from(signature);
    const expected = Buffer.from(sign(encoded, secret));
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;

    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as TestTokenPayload;
    if (
      payload.version !== 1
      || !Number.isFinite(payload.exp)
      || payload.exp <= Math.floor(Date.now() / 1000)
      || !/^[A-Za-z0-9_-]{16,100}$/.test(String(payload.nonce ?? ""))
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function createMarketplaceGuestQuoteTestToken(options?: { expiresInSeconds?: number }) {
  const secret = testTokenSecret();
  if (!secret) throw new Error("marketplace_guest_quote_test_secret_missing");

  const expiresInSeconds = options?.expiresInSeconds ?? TEST_TOKEN_TTL_SECONDS;
  const payload: TestTokenPayload = {
    version: 1,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    nonce: randomBytes(24).toString("base64url"),
  };
  const encoded = encode(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, secret)}`;
}

export function getMarketplaceGuestQuoteTestView(token: string): MarketplaceGuestQuoteTestView | null {
  const payload = readTestToken(token);
  return payload ? { expiresAt: new Date(payload.exp * 1000).toISOString() } : null;
}

export async function sendMarketplaceGuestQuoteTestInvitation(input: {
  adminUserId: string;
  recipientEmail: string;
  baseUrl: string;
  language?: "sv" | "en";
}) {
  const sql = getSql();
  if (!sql) return { ok: false as const, code: "database" };
  if (!marketplaceGuestInvitationEmailConfigured()) return { ok: false as const, code: "email_configuration" };

  const recipientEmail = normalizeMarketplaceRecipientEmail(input.recipientEmail);
  if (!isMarketplaceBusinessRecipientEmail(recipientEmail)) {
    return { ok: false as const, code: "business_email_required" };
  }
  const language = input.language === "en" ? "en" : "sv";
  const auditSecret = testTokenSecret();
  if (!auditSecret) return { ok: false as const, code: "token_configuration" };

  const normalizedBaseUrl = input.baseUrl.replace(/\/$/, "");
  let testToken: string;
  try {
    testToken = createMarketplaceGuestQuoteTestToken();
  } catch {
    return { ok: false as const, code: "token_configuration" };
  }

  const dispatchToken = randomUUID();
  const emailHash = recipientHash(recipientEmail, auditSecret);

  let reservationRows: Array<Record<string, unknown>>;
  try {
    const [, rows] = await sql.transaction([
      sql`select pg_advisory_xact_lock(hashtextextended(${`marketplace-guest-quote-test:${emailHash}`}, 0))`,
      sql`
      with recent_reservation as (
        select 1
        from admin_audit_logs
        where action = ${TEST_AUDIT_RESERVATION_ACTION}
          and created_at > now() - interval '15 minutes'
          and new_value->>'recipient_hash' = ${emailHash}
        limit 1
      ), reservation as (
        insert into admin_audit_logs (admin_user_id, action, reason, new_value)
        select
          ${input.adminUserId},
          ${TEST_AUDIT_RESERVATION_ACTION},
          'Super admin reserved a controlled Guest Quote email-delivery test. No company profile, quote request, invitation, offer, or suppression record is used.',
          ${JSON.stringify({ recipient_hash: emailHash, dispatch_token: dispatchToken, token_ttl_seconds: TEST_TOKEN_TTL_SECONDS })}::jsonb
        where not exists (select 1 from recent_reservation)
        returning id
      )
      select exists(select 1 from reservation) as reserved
      `,
    ]);
    reservationRows = rows as Array<Record<string, unknown>>;
  } catch (error) {
    console.error("Failed to reserve marketplace guest quote test", error);
    return { ok: false as const, code: "audit" };
  }
  if (reservationRows[0]?.reserved !== true) return { ok: false as const, code: "rate_limited" };

  const replyUrl = new URL(`${normalizedBaseUrl}/offert/testa/${encodeURIComponent(testToken)}`);
  if (language === "en") replyUrl.searchParams.set("lang", "en");
  const delivery = await sendMarketplaceGuestInvitationEmail({
    recipientEmail,
    companyName: "Proffera testmottagare",
    quoteReferenceId: "TEST-GUEST-QUOTE",
    category: "Test – ingen kund",
    serviceType: "Kontroll av Guest Quote",
    city: "Testmiljö",
    preferredDate: "Inte angivet",
    replyUrl: replyUrl.toString(),
    optOutUrl: replyUrl.toString(),
    idempotencyKey: dispatchToken,
    testMode: true,
    language,
  });

  if (!delivery.ok) {
    console.error("Marketplace guest quote test delivery failed", { code: delivery.code });
    return { ok: false as const, code: `email_${delivery.code}` };
  }

  try {
    await sql`
      insert into admin_audit_logs (admin_user_id, action, reason, new_value)
      values (
        ${input.adminUserId},
        ${TEST_AUDIT_SENT_ACTION},
        'Super admin sent a controlled Guest Quote email-delivery test. The link is signed, expires in one hour, and has no production quote or company side effects.',
        ${JSON.stringify({ recipient_hash: emailHash, provider_message_id: delivery.providerMessageId ?? "", token_ttl_seconds: TEST_TOKEN_TTL_SECONDS })}::jsonb
      )
    `;
  } catch (error) {
    console.error("Marketplace guest quote test was delivered but audit logging failed", error);
  }

  return { ok: true as const };
}
