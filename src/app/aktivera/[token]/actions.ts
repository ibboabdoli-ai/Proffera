"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { claimWorkspaceInvitation } from "@/features/company/workspace-invitation";
import { authRedirectHref, type AuthLocale } from "@/lib/auth-locale";

const passwordSchema = z.object({
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).refine((value) => value.password === value.confirmPassword, {
  path: ["confirmPassword"],
});

export async function activateWorkspaceAction(token: string, formData: FormData) {
  const locale: AuthLocale = String(formData.get("lang") ?? "") === "en" ? "en" : "sv";
  const redirectQuery = String(formData.get("redirect_query") ?? "").slice(0, 4096);
  const activationPath = `/aktivera/${encodeURIComponent(token)}`;
  const parsed = passwordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirm_password") ?? ""),
  });

  if (!parsed.success) {
    redirect(authRedirectHref(activationPath, redirectQuery, locale, { error: "password" }));
  }

  const result = await claimWorkspaceInvitation(token, parsed.data.password);

  if (!result.ok) {
    redirect(authRedirectHref(activationPath, redirectQuery, locale, { error: result.code }));
  }

  redirect(authRedirectHref("/logga-in", redirectQuery, locale, { error: null, created: "1" }));
}
