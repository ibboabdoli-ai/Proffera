"use server";

import { redirect } from "next/navigation";
import { addExistingWorkspaceMember, isEditableWorkspaceRole, removeWorkspaceMember, updateWorkspaceMemberRole } from "@/lib/workspace-members-db";

const value = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
function finish(result: { ok: true } | { ok: false; code: string }): never {
  redirect(result.ok ? "/dashboard/installningar?member_updated=1" : `/dashboard/installningar?member_error=${result.code}`);
}

export async function addWorkspaceMemberAction(formData: FormData) {
  const role = value(formData, "role");
  if (!isEditableWorkspaceRole(role)) redirect("/dashboard/installningar?member_error=invalid");
  finish(await addExistingWorkspaceMember(value(formData, "email").toLowerCase(), role));
}

export async function updateWorkspaceMemberRoleAction(formData: FormData) {
  const role = value(formData, "role");
  if (!isEditableWorkspaceRole(role)) redirect("/dashboard/installningar?member_error=invalid");
  finish(await updateWorkspaceMemberRole(value(formData, "membership_id"), role));
}

export async function removeWorkspaceMemberAction(formData: FormData) {
  finish(await removeWorkspaceMember(value(formData, "membership_id")));
}
