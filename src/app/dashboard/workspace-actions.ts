"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getUserWorkspaceOptions, selectedWorkspaceCookieName } from "@/lib/workspace-access";

export async function switchWorkspaceAction(formData: FormData) {
  const workspaceId = String(formData.get("workspace_id") ?? "");
  const workspaces = await getUserWorkspaceOptions();

  if (!workspaces.some((workspace) => workspace.id === workspaceId)) {
    redirect("/dashboard?workspace=invalid");
  }

  const cookieStore = await cookies();
  cookieStore.set(selectedWorkspaceCookieName, workspaceId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/dashboard");
}
