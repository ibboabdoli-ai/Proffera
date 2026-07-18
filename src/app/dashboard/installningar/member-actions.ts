"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { addExistingWorkspaceMember, isEditableWorkspaceRole, removeWorkspaceMember, updateWorkspaceMemberRole } from "@/lib/workspace-members-db";
import { createWorkspaceMemberInvitation } from "@/features/company/workspace-member-invitation";

const value = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
function finish(result: { ok: true } | { ok: false; code: string }): never {
  redirect(result.ok ? "/dashboard/installningar?member_updated=1" : `/dashboard/installningar?member_error=${result.code}`);
}

export async function addWorkspaceMemberAction(formData: FormData) {
  const role = value(formData, "role");
  if (!isEditableWorkspaceRole(role)) redirect("/dashboard/installningar?member_error=invalid");
  const email = value(formData, "email").toLowerCase();
  const existing = await addExistingWorkspaceMember(email, role);
  if (existing.ok || existing.code !== "not_found") finish(existing);
  const requestHeaders = await headers();
  const result = await createWorkspaceMemberInvitation({ email, memberName: value(formData, "name") || email.split("@")[0] || "Ny användare", role, origin: new URL(requestHeaders.get("origin") ?? "https://www.proffera.se").origin });
  redirect(result.ok ? "/dashboard/installningar?member_updated=invited" : `/dashboard/installningar?member_error=${result.code}`);
}

export async function updateWorkspaceMemberRoleAction(formData: FormData) {
  const role = value(formData, "role");
  if (!isEditableWorkspaceRole(role)) redirect("/dashboard/installningar?member_error=invalid");
  finish(await updateWorkspaceMemberRole(value(formData, "membership_id"), role));
}

export async function removeWorkspaceMemberAction(formData: FormData) {
  finish(await removeWorkspaceMember(value(formData, "membership_id")));
}
