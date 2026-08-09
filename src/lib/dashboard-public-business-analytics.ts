import "server-only";

import { getSql } from "@/lib/db/server";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";

export type PublicBusinessAnalyticsSummary = {
  visitors: number;
  businessViews: number;
  serviceViews: number;
  bookClicks: number;
  quoteClicks: number;
  contactClicks: number;
  actionSessions: number;
  actionRate: number;
};

export type PublicBusinessServiceAnalytics = {
  serviceId: string;
  serviceName: string;
  publicSlug: string;
  views: number;
  bookClicks: number;
  quoteClicks: number;
  contactClicks: number;
  actions: number;
};

export type PublicBusinessAnalytics = {
  days: number;
  summary: PublicBusinessAnalyticsSummary;
  services: PublicBusinessServiceAnalytics[];
};

function number(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function getDashboardPublicBusinessAnalytics(days = 30): Promise<PublicBusinessAnalytics> {
  const access = await getUserWorkspaceAccess();
  if (!access.ok) throw new Error("A valid workspace membership is required for public business analytics");

  const sql = getSql();
  const safeDays = Math.max(1, Math.min(90, Math.round(days)));
  const empty: PublicBusinessAnalytics = {
    days: safeDays,
    summary: {
      visitors: 0,
      businessViews: 0,
      serviceViews: 0,
      bookClicks: 0,
      quoteClicks: 0,
      contactClicks: 0,
      actionSessions: 0,
      actionRate: 0,
    },
    services: [],
  };
  if (!sql) return empty;

  try {
    const [summaryRows, serviceRows] = await Promise.all([
      sql`
        with period_events as (
          select event_key, session_key
          from public_business_events
          where workspace_id = ${access.workspaceId}::uuid
            and created_at >= now() - (${safeDays}::text || ' days')::interval
        ), visitor_sessions as (
          select distinct session_key
          from period_events
          where event_key in ('business_view', 'service_view')
            and nullif(session_key, '') is not null
        ), action_sessions as (
          select distinct session_key
          from period_events
          where event_key in ('book_clicked', 'quote_clicked', 'contact_clicked')
            and nullif(session_key, '') is not null
        )
        select
          (select count(*) from visitor_sessions) as visitors,
          count(*) filter (where event_key = 'business_view') as business_views,
          count(*) filter (where event_key = 'service_view') as service_views,
          count(*) filter (where event_key = 'book_clicked') as book_clicks,
          count(*) filter (where event_key = 'quote_clicked') as quote_clicks,
          count(*) filter (where event_key = 'contact_clicked') as contact_clicks,
          (select count(*) from action_sessions) as action_sessions
        from period_events
      `,
      sql`
        select
          service.id::text as service_id,
          service.name as service_name,
          coalesce(service.public_slug, '') as public_slug,
          count(event.id) filter (where event.event_key = 'service_view') as views,
          count(event.id) filter (where event.event_key = 'book_clicked') as book_clicks,
          count(event.id) filter (where event.event_key = 'quote_clicked') as quote_clicks,
          count(event.id) filter (where event.event_key = 'contact_clicked') as contact_clicks
        from workspace_services service
        left join public_business_events event
          on event.workspace_id = ${access.workspaceId}::uuid
         and event.service_id = service.id
         and event.created_at >= now() - (${safeDays}::text || ' days')::interval
        where service.workspace_id = ${access.workspaceId}
          and service.public_status = 'published'
        group by service.id, service.name, service.public_slug, service.sort_order
        having count(event.id) > 0
        order by
          count(event.id) filter (where event.event_key in ('book_clicked', 'quote_clicked', 'contact_clicked')) desc,
          count(event.id) filter (where event.event_key = 'service_view') desc,
          service.sort_order asc,
          service.name asc
        limit 10
      `,
    ]);

    const summaryRow = summaryRows[0] ?? {};
    const visitors = number(summaryRow.visitors);
    const actionSessions = number(summaryRow.action_sessions);
    const actionRate = visitors > 0 ? Math.min(100, Math.round((actionSessions / visitors) * 1000) / 10) : 0;

    return {
      days: safeDays,
      summary: {
        visitors,
        businessViews: number(summaryRow.business_views),
        serviceViews: number(summaryRow.service_views),
        bookClicks: number(summaryRow.book_clicks),
        quoteClicks: number(summaryRow.quote_clicks),
        contactClicks: number(summaryRow.contact_clicks),
        actionSessions,
        actionRate,
      },
      services: serviceRows.map((row) => {
        const bookClicks = number(row.book_clicks);
        const quoteClicks = number(row.quote_clicks);
        const contactClicks = number(row.contact_clicks);
        return {
          serviceId: String(row.service_id ?? ""),
          serviceName: String(row.service_name ?? ""),
          publicSlug: String(row.public_slug ?? ""),
          views: number(row.views),
          bookClicks,
          quoteClicks,
          contactClicks,
          actions: bookClicks + quoteClicks + contactClicks,
        };
      }),
    };
  } catch (error) {
    console.error("Failed to read public business analytics", error);
    return empty;
  }
}
