import { NextResponse } from "next/server";
import { getUserWorkspaceAccess, canManageWorkspaceMembers } from "@/lib/workspace-access";
import { changeMariaBookingSoftDelete } from "@/lib/maria-booking-soft-delete";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin)
    return NextResponse.json({ error: "Ogiltig begäran." }, { status: 403 });
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceMembers(access)
    || access.workspaceSlug !== "makeup-by-maria")
    return NextResponse.json({ error: "Endast Owner får hantera arkivet." }, { status: 403 });
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error("Invalid");
    body = parsed as Record<string, unknown>;
  } catch { return NextResponse.json({ error: "Ogiltig begäran." }, { status: 400 }); }
  const id = body.bookingId;
  const action = body.action;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)
    || (action !== "hide" && action !== "restore")
    || body.acknowledged !== true || body.confirmation !== id)
    return NextResponse.json({ error: "Boknings-ID måste skrivas in exakt." }, { status: 400 });
  const result = await changeMariaBookingSoftDelete({
    workspaceId: access.workspaceId, bookingId: id, actorId: access.userId, action,
  });
  return NextResponse.json(
    result === "updated" ? { updated: true } : { error: result === "unchanged"
      ? "Åtgärden är inte tillåten för den här bokningen."
      : "Bokningsarkivet är inte tillgängligt." },
    { status: result === "updated" ? 200 : result === "unchanged" ? 409 : 503,
      headers: { "Cache-Control": "no-store" } },
  );
}
