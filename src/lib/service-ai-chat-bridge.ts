import "server-only";

import { getSql } from "@/lib/db/server";
import { signServiceAiChatRequest } from "@/lib/service-ai-chat-signature";
import { siteConfig } from "@/lib/site";

export type AiChatLifecycle = "active" | "suspended";

type RemoteBridgeResponse = {
  tenantId?: unknown;
  clientId?: unknown;
  lifecycle?: unknown;
  token?: unknown;
  expiresAt?: unknown;
  error?: unknown;
};

export type WorkspaceAiChatIntegration = {
  databaseReady: boolean;
  tenantId: string | null;
  clientId: string | null;
  lifecycle: AiChatLifecycle | null;
  lastErrorCode: string | null;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bridgeUrl = process.env.SERVICE_AI_CHAT_BRIDGE_URL?.trim() || "";
const bridgeSecret = process.env.SERVICE_AI_CHAT_INTEGRATION_SECRET?.trim() || "";
const chatOrigin = process.env.SERVICE_AI_CHAT_ORIGIN?.trim().replace(/\/$/, "") || "https://chat.proffera.se";

function asText(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function asLifecycle(value: unknown): AiChatLifecycle | null {
  return value === "active" || value === "suspended" ? value : null;
}

export function isServiceAiChatBridgeConfigured() {
  return Boolean(bridgeUrl && bridgeSecret);
}

async function callBridge(payload: Record<string, unknown>) {
  if (!isServiceAiChatBridgeConfigured()) {
    return { ok: false as const, code: "not_configured" as const, data: null };
  }

  const body = JSON.stringify(payload);
  const timestamp = new Date().toISOString();

  try {
    const response = await fetch(bridgeUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-proffera-timestamp": timestamp,
        "x-proffera-signature": signServiceAiChatRequest(timestamp, body, bridgeSecret),
      },
      body,
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({})) as RemoteBridgeResponse;

    if (!response.ok) {
      return { ok: false as const, code: asText(data.error) || `remote_${response.status}`, data };
    }

    return { ok: true as const, code: null, data };
  } catch (error) {
    console.error("Service AI Chat bridge request failed", error);
    return { ok: false as const, code: "network_error" as const, data: null };
  }
}

async function getWorkspaceIdentity(workspaceId: string) {
  const sql = getSql();
  if (!sql || !uuidPattern.test(workspaceId)) return null;

  const rows = await sql`
    select
      w.id,
      w.name,
      w.public_booking_slug,
      coalesce((
        select u.email
        from workspace_memberships wm
        join "user" u on u.id = wm.user_id
        where wm.workspace_id = w.id
          and wm.role = 'owner'
        order by wm.created_at asc
        limit 1
      ), '') as owner_email
    from workspaces w
    where w.id = ${workspaceId}::uuid
    limit 1
  `;
  const row = rows[0];
  const name = asText(row?.name).trim();
  const ownerEmail = asText(row?.owner_email).trim().toLowerCase();
  const bookingSlug = asText(row?.public_booking_slug).trim();
  const bookingBaseUrl = siteConfig.url.replace(/^https?:\/\/(?:www\.)?/, "https://www.").replace(/\/$/, "");
  const bookingUrl = bookingSlug ? `${bookingBaseUrl}/boka/${encodeURIComponent(bookingSlug)}` : bookingBaseUrl;

  return name && ownerEmail ? { name, ownerEmail, bookingUrl } : null;
}

export async function getWorkspaceAiChatIntegration(workspaceId: string): Promise<WorkspaceAiChatIntegration> {
  const sql = getSql();
  if (!sql || !uuidPattern.test(workspaceId)) {
    return { databaseReady: false, tenantId: null, clientId: null, lifecycle: null, lastErrorCode: null };
  }

  try {
    const rows = await sql`
      select remote_tenant_id, remote_client_id, lifecycle_state, last_error_code
      from workspace_ai_chat_integrations
      where workspace_id = ${workspaceId}::uuid
      limit 1
    `;
    const row = rows[0];
    return {
      databaseReady: true,
      tenantId: asText(row?.remote_tenant_id) || null,
      clientId: asText(row?.remote_client_id) || null,
      lifecycle: asLifecycle(row?.lifecycle_state),
      lastErrorCode: asText(row?.last_error_code) || null,
    };
  } catch (error) {
    console.error("Failed to read AI Chat integration", error);
    return { databaseReady: false, tenantId: null, clientId: null, lifecycle: null, lastErrorCode: null };
  }
}

export async function syncWorkspaceAiChat(input: { workspaceId: string; enabled: boolean }) {
  const sql = getSql();
  if (!sql || !uuidPattern.test(input.workspaceId)) return { ok: false as const, code: "database" as const };

  const existing = await getWorkspaceAiChatIntegration(input.workspaceId);
  if (!input.enabled && !existing.tenantId) return { ok: true as const, skipped: true as const };

  const identity = await getWorkspaceIdentity(input.workspaceId);
  if (!identity) return { ok: false as const, code: "workspace_identity" as const };

  const lifecycle: AiChatLifecycle = input.enabled ? "active" : "suspended";
  const remote = await callBridge({
    action: "provision",
    workspaceId: input.workspaceId,
    workspaceName: identity.name,
    ownerEmail: identity.ownerEmail,
    // The remote tenant is keyed to this workspace's own public booking URL.
    // It lets the chat service reuse a previously configured tenant safely
    // and gives new tenants the correct Proffera allowlist from the start.
    website: identity.bookingUrl,
    lifecycle,
  });

  if (!remote.ok) {
    await sql`
      update workspace_ai_chat_integrations
      set last_error_code = ${remote.code}, updated_at = now()
      where workspace_id = ${input.workspaceId}::uuid
    `;
    return { ok: false as const, code: remote.code };
  }

  const tenantId = asText(remote.data.tenantId);
  const clientId = asText(remote.data.clientId);
  const remoteLifecycle = asLifecycle(remote.data.lifecycle);
  if (!tenantId || !clientId || !remoteLifecycle) return { ok: false as const, code: "invalid_remote_response" as const };

  await sql`
    insert into workspace_ai_chat_integrations (
      workspace_id, remote_tenant_id, remote_client_id, lifecycle_state, last_synced_at, last_error_code, created_at, updated_at
    ) values (
      ${input.workspaceId}::uuid, ${tenantId}, ${clientId}, ${remoteLifecycle}, now(), null, now(), now()
    )
    on conflict (workspace_id)
    do update set
      remote_tenant_id = excluded.remote_tenant_id,
      remote_client_id = excluded.remote_client_id,
      lifecycle_state = excluded.lifecycle_state,
      last_synced_at = now(),
      last_error_code = null,
      updated_at = now()
  `;

  return { ok: true as const, tenantId, lifecycle: remoteLifecycle };
}

export async function createWorkspaceAiChatActivationUrl(workspaceId: string) {
  const integration = await getWorkspaceAiChatIntegration(workspaceId);
  if (!integration.tenantId || integration.lifecycle !== "active") return null;

  const remote = await callBridge({ action: "activation_link", workspaceId });
  const token = remote.ok ? asText(remote.data.token) : "";
  const expiresAt = remote.ok ? asText(remote.data.expiresAt) : "";
  if (!token || !expiresAt) return null;

  return `${chatOrigin}/activate/proffera?token=${encodeURIComponent(token)}`;
}
