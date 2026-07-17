import { ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import type { WorkspaceMember } from "@/lib/workspace-members-db";
import { addWorkspaceMemberAction, updateWorkspaceMemberRoleAction } from "./member-actions";
import { RemoveMemberForm } from "./remove-member-form";

const labels = { owner: "Owner", admin: "Admin", staff: "Staff", viewer: "Viewer" } as const;
const field = "min-h-11 rounded-xl border border-[#d9e1d7] bg-white px-3 text-sm text-[#17201a] outline-none focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/15";

export function WorkspaceMembersCard({ members, canManage }: { members: WorkspaceMember[]; canManage: boolean }) {
  return <article className="rounded-[24px] border border-[#e0e5dd] bg-white p-6 shadow-[0_14px_36px_rgba(20,43,32,0.045)]">
    <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-[#17452f]" aria-hidden="true" /><h3 className="text-xl font-bold text-[#17201a]">Team och behörigheter</h3></div><p className="mt-2 text-sm text-[#5b665f]">Hantera vilka som har åtkomst till arbetsytan.</p></div><span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">{members.length} medlemmar</span></div>
    {canManage ? <form action={addWorkspaceMemberAction} className="mt-5 grid gap-3 rounded-2xl bg-[#f7f9f6] p-4 sm:grid-cols-[minmax(0,1fr)_160px_auto] sm:items-end">
      <label className="grid gap-1.5 text-xs font-semibold text-[#405047]">Befintlig användares e-post<input name="email" type="email" required maxLength={180} autoComplete="email" placeholder="namn@foretag.se" className={field} /></label>
      <label className="grid gap-1.5 text-xs font-semibold text-[#405047]">Roll<select name="role" defaultValue="staff" className={field}><option value="admin">Admin</option><option value="staff">Staff</option><option value="viewer">Viewer</option></select></label>
      <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#17452f] px-4 text-sm font-bold text-white" type="submit"><UserPlus className="h-4 w-4" aria-hidden="true" />Lägg till</button>
      <p className="text-xs leading-5 text-[#667168] sm:col-span-3">Användaren behöver redan ha ett Proffera-konto. Owner-rollen är skyddad.</p>
    </form> : <p className="mt-5 rounded-xl bg-[#f7f9f6] p-4 text-sm text-[#5b665f]">Endast arbetsytans Owner kan ändra medlemmar.</p>}
    <div className="mt-5 grid gap-3">{members.map((member) => <div key={member.membershipId} className="grid gap-3 rounded-2xl border border-[#e4e9e2] p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0"><p className="truncate text-sm font-bold text-[#17201a]">{member.name}{member.isCurrentUser ? " · Du" : ""}</p><p className="mt-1 truncate text-xs text-[#667168]">{member.email}</p></div>
      {canManage && member.role !== "owner" ? <div className="flex flex-col gap-2 sm:flex-row"><form action={updateWorkspaceMemberRoleAction} className="flex gap-2"><input type="hidden" name="membership_id" value={member.membershipId} /><select name="role" defaultValue={member.role} aria-label={`Roll för ${member.name}`} className={field}><option value="admin">Admin</option><option value="staff">Staff</option><option value="viewer">Viewer</option></select><button className="min-h-11 rounded-xl border border-[#cfd8cf] px-3 text-sm font-bold text-[#17452f]" type="submit">Spara</button></form><RemoveMemberForm membershipId={member.membershipId} memberName={member.name} /></div> : <span className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-[#f1f4f0] px-3 text-xs font-bold text-[#405047]"><ShieldCheck className="h-4 w-4" aria-hidden="true" />{labels[member.role]}</span>}
    </div>)}</div>
  </article>;
}
