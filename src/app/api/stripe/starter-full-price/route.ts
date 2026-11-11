import { NextResponse } from "next/server";
import { canManageWorkspaceMembers, getUserWorkspaceAccess } from "@/lib/workspace-access";
import { acceptMariaStarterFullPrice } from "@/lib/maria-starter-full-price";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Ogiltig begäran." }, { status: 403 });
  }
  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceMembers(access)
    || access.workspaceSlug !== "makeup-by-maria") {
    return NextResponse.json({ error: "Endast Owner kan ändra abonnemanget." }, { status: 403 });
  }
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error("Invalid");
    body = parsed as Record<string, unknown>;
  } catch { return NextResponse.json({ error: "Ogiltig bekräftelse." }, { status: 400 }); }
  if (typeof body.subscriptionId !== "string" || typeof body.discountId !== "string"
    || typeof body.periodEnd !== "number" || body.nextAmountOre !== 29900
    || body.acknowledged !== true || typeof body.confirmation !== "string") {
    return NextResponse.json({ error: "Ogiltig bekräftelse." }, { status: 400 });
  }
  const result = await acceptMariaStarterFullPrice({
    workspaceId: access.workspaceId, userId: access.userId,
    subscriptionId: body.subscriptionId, discountId: body.discountId,
    periodEnd: body.periodEnd, nextAmountOre: 29900,
    acknowledged: true, confirmation: body.confirmation,
  });
  const status = result === "updated" ? 200 : result === "stale" ? 409 : 503;
  return NextResponse.json(
    result === "updated" ? { updated: true } : { error: result === "stale"
      ? "Abonnemanget har ändrats. Uppdatera sidan och granska priset igen."
      : "Stripe-bekräftelsen kunde inte slutföras. Kontrollera abonnemanget innan du försöker igen." },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
