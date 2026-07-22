import { NextResponse } from "next/server";

import { hasDashboardFeatureAccess } from "@/lib/workspace-module-access";
import { createWorkspaceAiChatActivationUrl, syncWorkspaceAiChat } from "@/lib/service-ai-chat-bridge";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

function redirect(request: Request, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function GET(request: Request) {
  const access = await getUserWorkspaceAccess();

  if (!access.ok || !canManageWorkspaceSettings(access)) {
    return redirect(request, "/dashboard/ai-assistent?error=forbidden");
  }

  if (!(await hasDashboardFeatureAccess("ai_assistant"))) {
    return redirect(request, "/dashboard/ai-assistent?error=not-entitled");
  }

  const sync = await syncWorkspaceAiChat({ workspaceId: access.workspaceId, enabled: true });
  if (!sync.ok) {
    return redirect(request, "/dashboard/ai-assistent?error=provisioning");
  }

  const activationUrl = await createWorkspaceAiChatActivationUrl(access.workspaceId);
  if (!activationUrl) {
    return redirect(request, "/dashboard/ai-assistent?error=activation");
  }

  return NextResponse.redirect(activationUrl);
}
