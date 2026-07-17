"use client";

import { removeWorkspaceMemberAction } from "./member-actions";

export function RemoveMemberForm({ membershipId, memberName }: { membershipId: string; memberName: string }) {
  return <form action={removeWorkspaceMemberAction} onSubmit={(event) => { if (!window.confirm(`Ta bort ${memberName} från arbetsytan?`)) event.preventDefault(); }}>
    <input type="hidden" name="membership_id" value={membershipId} />
    <button type="submit" className="min-h-11 w-full rounded-xl border border-[#e7b8b1] px-3 text-sm font-bold text-[#8a2b20] hover:bg-[#fff4f2]">Ta bort</button>
  </form>;
}
