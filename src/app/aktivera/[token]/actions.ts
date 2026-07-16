"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { claimWorkspaceInvitation } from "@/features/company/workspace-invitation";

const passwordSchema = z.object({
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
});

export async function activateWorkspaceAction(token: string, formData: FormData) {
  const parsed = passwordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirm_password") ?? ""),
  });

  if (!parsed.success) {
    redirect(`/aktivera/${token}?error=password`);
  }

  const result = await claimWorkspaceInvitation(token, parsed.data.password);

  if (!result.ok) {
    redirect(`/aktivera/${token}?error=${result.code}`);
  }

  redirect("/logga-in?created=1");
}
