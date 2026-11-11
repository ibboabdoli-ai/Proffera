import { getSql } from "@/lib/db/server";
import { countSmsSegments } from "@/lib/workspace-sms-quota";

export type WorkspaceSmsDelivery = { workspaceId: string; deliveryKey: string };
export type WorkspaceSmsResult =
  | { ok: true; skipped: false; providerId: string | null }
  | { ok: false; skipped: boolean; message: string };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizePhone(value: string) {
  const compact = value.replace(/[^\d+]/g, "");
  if (/^\+[1-9]\d{6,14}$/.test(compact)) return compact;
  if (/^00[1-9]\d{6,14}$/.test(compact)) return "+" + compact.slice(2);
  if (/^0\d{7,12}$/.test(compact)) return "+46" + compact.slice(1);
  return null;
}

async function reserveWorkspaceSms(input: WorkspaceSmsDelivery, content: string) {
  if (!uuidPattern.test(input.workspaceId) || !input.deliveryKey ||
    input.deliveryKey.length < 8 || input.deliveryKey.length > 200)
    return { allowed: false, reserved: false, message: "SMS source is invalid." };
  const sql = getSql();
  if (!sql) return { allowed: false, reserved: false, message: "SMS database unavailable." };
  try {
    const rows = await sql`
      select w.slug, p.plan_key, p.status as plan_status, p.current_period_end as plan_end,
             b.status as billing_status, b.current_period_end as billing_end,
             b.stripe_subscription_id, b.stripe_customer_id, f.enabled as sms_enabled
      from workspaces w
      left join workspace_billing_subscriptions b on b.workspace_id=w.id
      left join workspace_plans p on p.id=b.workspace_plan_id and p.workspace_id=w.id
      left join workspace_feature_flags f on f.workspace_id=w.id and f.feature_key='sms'
      where w.id=${input.workspaceId}::uuid limit 1
    `;
    const row = rows[0];
    if (!row) return { allowed: false, reserved: false, message: "Workspace unavailable." };
    const starter = row.plan_key === "starter";
    const maria = row.slug === "makeup-by-maria";
    if (!starter && !maria) return { allowed: true, reserved: false };

    if (!starter) {
      const now = Date.now();
      const paid = (row.plan_key === "professional" || row.plan_key === "business")
        && row.plan_status === "active" && row.billing_status === "active"
        && Boolean(row.stripe_subscription_id && row.stripe_customer_id)
        && Boolean(row.sms_enabled)
        && row.plan_end && row.billing_end
        && new Date(String(row.plan_end)).getTime() > now
        && new Date(String(row.billing_end)).getTime() > now;
      return paid
        ? { allowed: true, reserved: false }
        : { allowed: false, reserved: false, message: "Active paid SMS plan required." };
    }

    const units = countSmsSegments(content);
    if (units > 100) return { allowed: false, reserved: false, message: "SMS exceeds quota." };
    const result = await sql`
      select reserve_workspace_starter_sms(
        ${input.workspaceId}::uuid, ${input.deliveryKey}::text, ${units}::integer
      ) as result
    `;
    if (result[0]?.result !== "reserved") {
      return {
        allowed: false, reserved: false,
        message: result[0]?.result === "quota_exhausted"
          ? "Monthly SMS limit reached." : "SMS is unavailable or already processed.",
      };
    }
    return { allowed: true, reserved: true };
  } catch (error) {
    console.error("Workspace SMS quota reservation failed", error);
    return { allowed: false, reserved: false, message: "SMS quota unavailable." };
  }
}

async function settleReservation(input: WorkspaceSmsDelivery, status: "sent" | "uncertain" | "rejected", providerId?: string) {
  const sql = getSql();
  if (!sql) return;
  try {
    await sql`
      update workspace_sms_dispatches
      set status=${status}, provider_id=${providerId ?? null}, updated_at=now()
      where workspace_id=${input.workspaceId}::uuid
        and delivery_key=${input.deliveryKey} and status='reserved'
    `;
  } catch (error) {
    // Never resend because journal persistence failed: the reservation remains charged.
    console.error("Workspace SMS quota settlement failed", error);
  }
}

export async function sendWorkspaceTransactionalSms(input: WorkspaceSmsDelivery & {
  customerPhone: string; content: string; language?: "sv" | "en";
}): Promise<WorkspaceSmsResult> {
  if (process.env.VERCEL_ENV === "preview") {
    return { ok: false, skipped: true, message: input.language === "en"
      ? "SMS is disabled in Vercel Preview." : "SMS är avstängt i Vercel Preview." };
  }
  const key = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SMS_SENDER?.trim();
  if (!key || !sender) return { ok: false, skipped: true, message: "Brevo SMS is not enabled." };
  const recipient = normalizePhone(input.customerPhone);
  if (!recipient) return { ok: false, skipped: true, message: "Invalid mobile phone number." };
  const entitlement = await reserveWorkspaceSms(input, input.content);
  if (!entitlement.allowed) return { ok: false, skipped: true, message: entitlement.message || "SMS denied." };
  try {
    const response = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ sender: sender.slice(0, 11), recipient, content: input.content, type: "transactional" }),
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await response.json().catch(() => ({})) as {
      messageId?: number | string; message?: string; code?: string;
    };
    if (response.ok) {
      if (entitlement.reserved) await settleReservation(input, "sent",
        payload.messageId === undefined ? undefined : String(payload.messageId));
      return { ok: true, skipped: false,
        providerId: payload.messageId === undefined ? null : String(payload.messageId) };
    }
    // Ambiguous HTTP 408/429/5xx never release quota; don't auto-retry them.
    if (entitlement.reserved) await settleReservation(input,
      response.status === 400 || response.status === 422 ? "rejected" : "uncertain");
    return { ok: false, skipped: false,
      message: payload.message ?? payload.code ?? "SMS provider rejected the request." };
  } catch {
    if (entitlement.reserved) await settleReservation(input, "uncertain");
    return { ok: false, skipped: false, message: "SMS provider outcome is uncertain." };
  }
}
