"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { claimWorkspaceMemberInvitation } from "@/features/company/workspace-member-invitation";
const schema=z.object({password:z.string().min(8).max(128),confirmPassword:z.string().min(8).max(128)}).refine(v=>v.password===v.confirmPassword,{path:["confirmPassword"]});
export async function acceptMemberInvitationAction(token:string,formData:FormData){const parsed=schema.safeParse({password:String(formData.get("password")??""),confirmPassword:String(formData.get("confirm_password")??"")});if(!parsed.success)redirect(`/bjud-in/${token}?error=password`);const result=await claimWorkspaceMemberInvitation(token,parsed.data.password);if(!result.ok)redirect(`/bjud-in/${token}?error=${result.code}`);redirect("/logga-in?created=1");}
