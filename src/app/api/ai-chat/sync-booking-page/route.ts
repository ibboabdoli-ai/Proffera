import { NextResponse } from "next/server";

import { hasDashboardFeatureAccess } from "@/lib/workspace-module-access";
import { syncWorkspaceAiChat } from "@/lib/service-ai-chat-bridge";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

function redirect(request: Request, query = "") {
  return NextResponse.redirect(new URL(`/dashboard/ai-assistent${query}`, request.url));
}

/**
 * Updates the trusted booking-page origin for an existing tenant. This is
 * safe to repeat: the remote provision call is keyed by workspace id, so it
 * never creates a second tenant or changes the subscription.
 */
export async function GET(request: Request) {
  const access = await getUserWorkspaceAccess();

  if (!access.ok || !canManageWorkspaceSettings(access)) {
    return redirect(request, "?error=forbidden");
  }

  if (!(await hasDashboardFeatureAccess("ai_assistant"))) {
    return redirect(request, "?error=not-entitled");
  }

  const sync = await syncWorkspaceAiChat({ workspaceId: access.workspaceId, enabled: true });
  return redirect(request, sync.ok ? "?synced=booking" : "?error=provisioning");
}
