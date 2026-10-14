import { NextResponse } from "next/server";

import { getSql } from "@/lib/db/server";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

// Read-only, scoped to this one customer's approved preview.
// Draft services are visible only to an authenticated member managing the
// matching workspace. No booking submissions or customer details are exposed.
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const demo = { connected: false, previewOnly: true, prices2026: {}, hours: [] };

export async function GET() {
  const sql = getSql();
  if (!sql) return NextResponse.json(demo, { headers });

  try {
    const workspaceRows = await sql`
      select id::text as id, status
      from workspaces
      where slug = 'makeup-by-maria'
      limit 1
    `;
    const workspace = workspaceRows[0];
    if (!workspace || !["active", "trial"].includes(String(workspace.status))) {
      return NextResponse.json(demo, { headers });
    }

    const workspaceId = String(workspace.id);
    const access = await getUserWorkspaceAccess();
    const canPreviewDrafts = access.ok
      && access.workspaceId === workspaceId
      && canManageWorkspaceSettings(access);

    const [services, hours] = await Promise.all([
      sql`
        select public_slug, price_type, price_amount_minor, base_price_sek
        from workspace_services
        where workspace_id = ${workspaceId}
          and is_active = true
          and public_slug in (
            'maria-bridal-trial-2026',
            'maria-bridal-without-trial-2026'
          )
          and (
            public_status = 'published'
            or (${canPreviewDrafts}::boolean and public_status = 'draft')
          )
      `,
      sql`
        select weekday, opens_at::text as opens_at,
          closes_at::text as closes_at, is_closed
        from workspace_booking_hours
        where workspace_id = ${workspaceId}
          and weekday in (5, 6)
        order by weekday
      `,
    ]);

    const prices2026: Record<string, number> = {};
    for (const service of services) {
      const key = service.public_slug === "maria-bridal-trial-2026"
        ? "trial"
        : service.public_slug === "maria-bridal-without-trial-2026"
          ? "without"
          : null;
      if (!key || service.price_type !== "fixed") continue;
      const amount = Number(service.price_amount_minor);
      if (!Number.isSafeInteger(amount) || amount < 0 || amount > 100000000) continue;
      prices2026[key] = amount / 100;
    }

    const schedule = hours
      .filter((row) => !row.is_closed)
      .map((row) => ({
        weekday: Number(row.weekday),
        opensAt: String(row.opens_at ?? "").slice(0, 5),
        closesAt: String(row.closes_at ?? "").slice(0, 5),
      }))
      .filter((row) =>
        [5, 6].includes(row.weekday)
        && /^\d{2}:\d{2}$/.test(row.opensAt)
        && /^\d{2}:\d{2}$/.test(row.closesAt)
        && row.opensAt < row.closesAt
      );

    return NextResponse.json({
      connected: true,
      previewOnly: true,
      editorPreview: canPreviewDrafts,
      prices2026,
      hours: schedule,
    }, { headers });
  } catch (error) {
    console.error("Maria preview settings could not be read", error);
    return NextResponse.json(demo, { headers });
  }
}
