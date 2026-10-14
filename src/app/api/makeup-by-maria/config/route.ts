import { NextResponse } from "next/server";

import { getSql } from "@/lib/db/server";
import { canManageWorkspaceSettings, getUserWorkspaceAccess } from "@/lib/workspace-access";

// Read-only, scoped to this one customer's approved preview.
// Draft services are visible only to an authenticated member managing the
// matching workspace. No booking submissions or customer details are exposed.
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };
const demo = { connected: false, previewOnly: true, prices2026: {}, years: [
  { year: 2026, enabled: true, trial: 6800, without: 5800 },
  { year: 2027, enabled: true, trial: null, without: null },
  { year: 2028, enabled: true, trial: null, without: null },
], hours: [] };

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
        select public_slug, price_type, price_amount_minor, is_active
        from workspace_services
        where workspace_id = ${workspaceId}
          and public_slug ~ '^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$'
          and (
            public_status = 'published'
            or (${canPreviewDrafts || process.env.VERCEL_ENV === "preview"}::boolean and public_status = 'draft')
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

    // This endpoint exposes only the approved Maria demo's year/price values,
    // never customer data. Draft values may be viewed publicly on Preview only.
    const defaults = new Map<number, {year: number; enabled: boolean; trial: number | null; without: number | null}>([
      [2026, {year:2026, enabled:true, trial:6800, without:5800}],
      [2027, {year:2027, enabled:true, trial:null, without:null}],
      [2028, {year:2028, enabled:true, trial:null, without:null}],
    ]);
    const saved = new Map<number, {trial?: {enabled: boolean; value: number | null}; without?: {enabled: boolean; value: number | null}}>();
    for (const row of services) {
      const match = /^maria-bridal-(trial|without-trial)-(202[6-9]|203[0-6])$/.exec(String(row.public_slug));
      if (!match) continue;
      const year = Number(match[2]);
      const kind = match[1] === "trial" ? "trial" : "without";
      const amount = Number(row.price_amount_minor);
      const value = row.price_type === "fixed"
        && row.price_amount_minor !== null && Number.isSafeInteger(amount) && amount >= 0 && amount <= 25000000
        ? amount / 100
        : null;
      const item = saved.get(year) ?? {};
      item[kind] = {enabled: row.is_active === true, value};
      saved.set(year, item);
    }
    for (const [year, items] of saved) {
      const original = defaults.get(year);
      defaults.set(year, {
        year,
        enabled: Boolean(items.trial?.enabled && items.without?.enabled),
        trial: items.trial ? items.trial.value : (original?.trial ?? null),
        without: items.without ? items.without.value : (original?.without ?? null),
      });
    }
    const years = [...defaults.values()].sort((a,b)=>a.year-b.year).filter(v=>v.enabled);
    const prices2026 = {
      trial: defaults.get(2026)?.trial ?? undefined,
      without: defaults.get(2026)?.without ?? undefined,
    };

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
      years,
      hours: schedule,
    }, { headers });
  } catch (error) {
    console.error("Maria preview settings could not be read", error);
    return NextResponse.json(demo, { headers });
  }
}
