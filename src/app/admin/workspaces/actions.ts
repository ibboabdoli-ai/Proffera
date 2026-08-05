"use server";

import { redirect } from "next/navigation";

import {
  downgradeSupportSession,
  elevateSupportSession,
  endSupportSession,
  startReadOnlySupportSession,
} from "@/lib/platform-admin";

export async function startSupportSessionAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  const supportSession = await startReadOnlySupportSession(workspaceId, reason);
  redirect(`/admin/support/${supportSession.id}`);
}

export async function elevateSupportSessionAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  await elevateSupportSession(sessionId, reason);
  redirect(`/admin/support/${sessionId}`);
}

export async function downgradeSupportSessionAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  await downgradeSupportSession(sessionId);
  redirect(`/admin/support/${sessionId}`);
}

export async function endSupportSessionAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  await endSupportSession(sessionId);
  redirect("/admin/workspaces");
}
