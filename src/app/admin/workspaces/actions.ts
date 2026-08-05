"use server";

import { redirect } from "next/navigation";

import { endSupportSession, startReadOnlySupportSession } from "@/lib/platform-admin";

export async function startSupportSessionAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const supportSession = await startReadOnlySupportSession(workspaceId, reason);
  redirect(`/admin/support/${supportSession.id}`);
}

export async function endSupportSessionAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  await endSupportSession(sessionId);
  redirect("/admin/workspaces");
}
