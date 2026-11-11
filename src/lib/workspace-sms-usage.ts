import { getSql } from "@/lib/db/server";

export type WorkspaceSmsUsage = {
  limit: number | null;
  used: number;
  remaining: number;
  periodEnd: string | null;
  plan: string | null;
  active: boolean;
  available: boolean;
};

export async function getWorkspaceSmsUsage(workspaceId: string): Promise<WorkspaceSmsUsage> {
  const empty: WorkspaceSmsUsage = {
    limit: null, used: 0, remaining: 0, periodEnd: null,
    plan: null, active: false, available: false,
  };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId)) return empty;
  const sql = getSql();
  if (!sql) return empty;
  try {
    const rows = await sql`
      select billing.status, billing.sms_monthly_limit, billing.current_period_end,
        p.plan_key, p.status as plan_status, p.current_period_end as plan_end,
        coalesce((
          select sum(d.units) from workspace_sms_dispatches d
          where d.workspace_id=billing.workspace_id
            and d.stripe_subscription_id=billing.stripe_subscription_id
            and d.period_start=billing.current_period_start
            and d.status in ('reserved','sent','uncertain')
        ),0)::integer as used
      from workspace_billing_subscriptions billing
      left join workspace_plans p on p.id=billing.workspace_plan_id
      where billing.workspace_id=${workspaceId}::uuid limit 1
    `;
    const row = rows[0];
    if (!row) return { ...empty, available: true };
    const now=Date.now();
    const active = row.status === "active" && row.plan_status === "active"
      && row.current_period_end && row.plan_end
      && new Date(String(row.current_period_end)).getTime()>now
      && new Date(String(row.plan_end)).getTime()>now;
    const limit = active && row.plan_key === "starter" && [50,100].includes(Number(row.sms_monthly_limit))
      ? Number(row.sms_monthly_limit) : null;
    const used=Math.max(0,Number(row.used)||0);
    return {
      available:true, active:Boolean(active), limit, used,
      remaining:limit===null?0:Math.max(0,limit-used),
      periodEnd:row.current_period_end?new Date(String(row.current_period_end)).toISOString():null,
      plan:row.plan_key?String(row.plan_key):null,
    };
  } catch (error) {
    // A not-yet-migrated Production database should show unavailable, not fake usage.
    console.error("SMS usage could not be read", error);
    return empty;
  }
}
