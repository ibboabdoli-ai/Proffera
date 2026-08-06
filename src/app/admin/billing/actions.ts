"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { extendInternalWorkspaceTrial } from "@/lib/admin-billing-mutations";

export async function extendTrialAction(formData: FormData) {
  const workspaceId = String(formData.get("workspaceId") ?? "");

  try {
    await extendInternalWorkspaceTrial({
      workspaceId,
      workspacePlanId: String(formData.get("workspacePlanId") ?? ""),
      expectedCurrentPeriodEnd: String(formData.get("expectedCurrentPeriodEnd") ?? ""),
      days: String(formData.get("days") ?? ""),
      reason: String(formData.get("reason") ?? ""),
    });
  } catch {
    redirect("/admin/billing?notice=extension-failed");
  }

  revalidatePath("/admin/billing");
  revalidatePath(`/admin/workspaces/${workspaceId}`);
  revalidatePath("/admin/audit");
  redirect("/admin/billing?notice=trial-extended");
}
