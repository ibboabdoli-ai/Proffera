"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { claimWorkspaceMemberInvitation } from "@/features/company/workspace-member-invitation";

const schema = z.object({
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).refine((value) => value.password === value.confirmPassword, { path: ["confirmPassword"] });

function invitationHref(token: string, isEnglish: boolean, error?: string) {
  const query = new URLSearchParams();
  if (isEnglish) query.set("lang", "en");
  if (error) query.set("error", error);
  const suffix = query.toString();
  return `/bjud-in/${token}${suffix ? `?${suffix}` : ""}`;
}

export async function acceptMemberInvitationAction(token: string, formData: FormData) {
  const isEnglish = String(formData.get("lang") ?? "") === "en";
  const parsed = schema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirm_password") ?? ""),
  });

  if (!parsed.success) redirect(invitationHref(token, isEnglish, "password"));

  const result = await claimWorkspaceMemberInvitation(token, parsed.data.password);
  if (!result.ok) redirect(invitationHref(token, isEnglish, result.code));

  redirect(isEnglish ? "/logga-in?lang=en&created=1" : "/logga-in?created=1");
}
