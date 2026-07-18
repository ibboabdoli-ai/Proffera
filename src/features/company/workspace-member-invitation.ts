import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getAuth } from "@/lib/auth";
import { getSql } from "@/lib/db/server";
import { canManageWorkspaceMembers, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { isEditableWorkspaceRole, type EditableWorkspaceRole } from "@/lib/workspace-members-db";
import { sendWorkspaceMemberInvitationEmail } from "@/features/email/lead-email";

const TTL_HOURS = 48;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
export type MemberInvitation = { companyName: string; memberName: string; email: string; expiresAt: string };
export type PendingWorkspaceMemberInvitation = {
  id: string;
  memberName: string;
  email: string;
  role: EditableWorkspaceRole;
  expiresAt: string;
};
type Result = { ok: true } | { ok: false; code: "access" | "invalid" | "exists" | "email" | "expired" | "account" | "database" };

export async function createWorkspaceMemberInvitation(input: { email: string; memberName: string; role: EditableWorkspaceRole; origin: string }): Promise<Result> {
  const access = await getUserWorkspaceAccess(), sql = getSql();
  if (!access.ok || !canManageWorkspaceMembers(access)) return { ok: false, code: "access" };
  if (!sql || !input.email || input.email.length > 180 || !input.memberName || input.memberName.length > 120 || !isEditableWorkspaceRole(input.role)) return { ok: false, code: "invalid" };
  try {
    const existing = await sql`select id from "user" where lower(email) = lower(${input.email}) limit 1`;
    if (existing[0]?.id) return { ok: false, code: "exists" };
    const token = randomBytes(32).toString("base64url"), expiresAt = new Date(Date.now() + TTL_HOURS * 3600000);
    await sql`
      insert into workspace_member_invitations (workspace_id,email,member_name,role,token_hash,status,expires_at,created_by_user_id)
      values (${access.workspaceId}::uuid,${input.email.toLowerCase()},${input.memberName},${input.role},${hash(token)},'pending',${expiresAt.toISOString()}::timestamptz,${access.userId})
      on conflict (workspace_id,email) do update set member_name=excluded.member_name,role=excluded.role,token_hash=excluded.token_hash,status='pending',expires_at=excluded.expires_at,accepted_at=null,created_by_user_id=excluded.created_by_user_id,updated_at=now()
    `;
    const sent = await sendWorkspaceMemberInvitationEmail({ companyName: access.workspaceName, contactName: input.memberName, email: input.email, activationUrl: new URL(`/bjud-in/${token}`, input.origin).toString(), expiresInHours: TTL_HOURS });
    return sent.ok ? { ok: true } : { ok: false, code: "email" };
  } catch (error) { console.error("Failed to create member invitation", error); return { ok: false, code: "database" }; }
}

export async function getWorkspaceMemberInvitation(token: string): Promise<MemberInvitation | null> {
  const sql = getSql(); if (!sql || !token) return null;
  try { const rows = await sql`select w.name as company_name, i.member_name, i.email, i.expires_at from workspace_member_invitations i join workspaces w on w.id=i.workspace_id where i.token_hash=${hash(token)} and i.status='pending' and i.expires_at>now() limit 1`; const row=rows[0]; return row ? { companyName:String(row.company_name), memberName:String(row.member_name), email:String(row.email), expiresAt:new Date(String(row.expires_at)).toISOString() } : null; } catch { return null; }
}

export async function getPendingWorkspaceMemberInvitations(): Promise<PendingWorkspaceMemberInvitation[]> {
  const access = await getUserWorkspaceAccess();
  const sql = getSql();

  if (!access.ok || !canManageWorkspaceMembers(access) || !sql) return [];

  try {
    const rows = await sql`
      select id, member_name, email, role, expires_at
      from workspace_member_invitations
      where workspace_id = ${access.workspaceId}::uuid and status = 'pending' and expires_at > now()
      order by created_at desc
    `;

    return rows.map((row) => ({
      id: String(row.id),
      memberName: String(row.member_name),
      email: String(row.email),
      role: String(row.role) as EditableWorkspaceRole,
      expiresAt: new Date(String(row.expires_at)).toISOString(),
    }));
  } catch (error) {
    console.error("Failed to read pending workspace invitations", error);
    return [];
  }
}

export async function revokeWorkspaceMemberInvitation(id: string): Promise<Result> {
  const access = await getUserWorkspaceAccess();
  const sql = getSql();

  if (!access.ok || !canManageWorkspaceMembers(access)) return { ok: false, code: "access" };
  if (!sql || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, code: "invalid" };

  try {
    const rows = await sql`
      update workspace_member_invitations
      set status = 'revoked', updated_at = now()
      where id = ${id}::uuid and workspace_id = ${access.workspaceId}::uuid and status = 'pending'
      returning id
    `;

    return rows[0]?.id ? { ok: true } : { ok: false, code: "invalid" };
  } catch (error) {
    console.error("Failed to revoke workspace invitation", error);
    return { ok: false, code: "database" };
  }
}

export async function resendWorkspaceMemberInvitation(id: string, origin: string): Promise<Result> {
  const access = await getUserWorkspaceAccess();
  const sql = getSql();

  if (!access.ok || !canManageWorkspaceMembers(access)) return { ok: false, code: "access" };
  if (!sql || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, code: "invalid" };

  try {
    const rows = await sql`
      select email, member_name from workspace_member_invitations
      where id = ${id}::uuid and workspace_id = ${access.workspaceId}::uuid and status = 'pending' and expires_at > now()
      limit 1
    `;
    const invitation = rows[0];
    if (!invitation) return { ok: false, code: "expired" };

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + TTL_HOURS * 3600000);
    await sql`
      update workspace_member_invitations
      set token_hash = ${hash(token)}, expires_at = ${expiresAt.toISOString()}::timestamptz, updated_at = now()
      where id = ${id}::uuid and workspace_id = ${access.workspaceId}::uuid and status = 'pending'
    `;

    const sent = await sendWorkspaceMemberInvitationEmail({
      companyName: access.workspaceName,
      contactName: String(invitation.member_name),
      email: String(invitation.email),
      activationUrl: new URL(`/bjud-in/${token}`, origin).toString(),
      expiresInHours: TTL_HOURS,
    });

    return sent.ok ? { ok: true } : { ok: false, code: "email" };
  } catch (error) {
    console.error("Failed to resend workspace invitation", error);
    return { ok: false, code: "database" };
  }
}

export async function claimWorkspaceMemberInvitation(token: string, password: string): Promise<Result> {
  const sql = getSql(); if (!sql || !token) return { ok:false, code:"invalid" }; let invitationId="";
  try {
    const rows = await sql`select id,workspace_id,email,member_name,role,expires_at from workspace_member_invitations where token_hash=${hash(token)} and status='pending' limit 1`; const invitation=rows[0];
    if (!invitation) return { ok:false, code:"invalid" }; if (new Date(String(invitation.expires_at)).getTime() <= Date.now()) return { ok:false, code:"expired" };
    const reservation = await sql`update workspace_member_invitations set status='accepted',accepted_at=now(),updated_at=now() where id=${String(invitation.id)}::uuid and status='pending' and expires_at>now() returning id`; invitationId=String(reservation[0]?.id??""); if(!invitationId) return {ok:false,code:"invalid"};
    let userId=String((await sql`select id from "user" where lower(email)=lower(${String(invitation.email)}) limit 1`)[0]?.id??"");
    if (!userId) { try { userId=String((await getAuth().api.signUpEmail({ body:{ name:String(invitation.member_name),email:String(invitation.email),password } })).user.id); } catch { throw new Error("account"); } }
    await sql.transaction((tx)=>[tx`insert into workspace_memberships (id,workspace_id,user_id,role) values (gen_random_uuid(),${String(invitation.workspace_id)}::uuid,${userId},${String(invitation.role)}) on conflict (workspace_id,user_id) do nothing`,tx`update workspace_member_invitations set updated_at=now() where id=${invitationId}::uuid and status='accepted'`]);
    return {ok:true};
  } catch (error) { if(invitationId) await sql`update workspace_member_invitations set status='pending',accepted_at=null,updated_at=now() where id=${invitationId}::uuid and status='accepted'`.catch(()=>undefined); return {ok:false,code:error instanceof Error && error.message==='account'?'account':'database'}; }
}
