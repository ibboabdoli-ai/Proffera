import { get } from "@vercel/blob";

import { getSql } from "@/lib/db/server";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function notFound() {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const pathname = searchParams.get("pathname")?.trim() ?? "";
  const bookingId = searchParams.get("bookingId")?.trim() ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(bookingId) || !pathname.startsWith("primeview-booking/") || pathname.includes("..") || pathname.length > 800) return notFound();

  const access = await getUserWorkspaceAccess();
  if (!access.ok || !canManageWorkspaceSettings(access)) return notFound();

  const sql = getSql();
  if (!sql) return notFound();
  const rows = await sql`
    select id
    from workspaces
    where id = ${access.workspaceId}
      and public_booking_slug = 'primeview'
      and status in ('active', 'trial')
    limit 1
  `;
  if (!rows[0]) return notFound();

  const bookingRows = await sql`
    select id
    from bookings
    where id::text = ${bookingId}
      and workspace_id = ${access.workspaceId}
      and position(${`Photo: ${pathname}`} in coalesce(notes, '')) > 0
    limit 1
  `;
  if (!bookingRows[0]) return notFound();

  try {
    const result = await get(pathname, { access: "private" });
    if (!result || result.statusCode !== 200) return notFound();

    return new Response(result.stream, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": result.blob.contentType || "application/octet-stream",
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Failed to read PrimeView booking photo", error);
    return notFound();
  }
}
