"use server";

import { revalidatePath } from "next/cache";

import { updateWorkspaceContactInEditSession } from "@/lib/admin-workspace-mutations";

export async function updateWorkspaceContactAction(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  await updateWorkspaceContactInEditSession({
    sessionId,
    contactEmail: String(formData.get("contactEmail") ?? ""),
    contactPhone: String(formData.get("contactPhone") ?? ""),
    primaryCity: String(formData.get("primaryCity") ?? ""),
  });
  revalidatePath(`/admin/support/${sessionId}`);
}
