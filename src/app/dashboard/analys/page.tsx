import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  BarChart3,
  CalendarCheck2,
  Eye,
  FileText,
  MousePointerClick,
  Send,
  Users,
} from "lucide-react";

import {
  DashboardMetricGrid,
  DashboardPageHeader,
} from "@/components/dashboard/dashboard-page-ui";
import { getDashboardPublicBusinessAnalytics } from "@/lib/dashboard-public-business-analytics";
import { getUserWorkspaceAccess } from "@/lib/workspace-access";
import { hasDashboardFeatureAccess } from "@/lib/workspace-module-access";

export const dynamic = "force-dynamic";

type AnalyticsPageProps = {
  searchParams?: Promise<{ lang?: string | string[] }>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function localizedHref(href: string, isEnglish: boolean) {
  return isEnglish ? `${href}${href.includes("?") ? "&" : "?"}lang=en` : href;
}

function formatNumber(value: number, isEnglish: boolean) {
  return new Intl.NumberFormat(isEnglish ? "en-GB" : "sv-SE").format(value);
}

export default async function PublicBusinessAnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const [access, analyticsAccess, query] = await Promise.all([
    getUserWorkspaceAccess(),
    hasDashboardFeatureAccess("analytics"),
    searchParams ?? Promise.resolve(undefined),
  ]);
  const isEnglish = first(query?.lang) === "en";

  if (!access.ok) redirect(localizedHref("/dashboard", isEnglish));
  if (!analyticsAccess) redirect(localizedHref("/dashboard", isEnglish));

  const analytics = await getDashboardPublicBusinessAnalytics(30);
  const { summary, services } = analytics;
  const totalActions = summary.bookClicks + summary.quoteClicks + summary.contactClicks;
  const hasData = summary.businessViews + summary.serviceViews + totalActions > 0;

  const actionBreakdown = [
    {
      label: isEnglish ? "Booking clicks" : "Bokningsklick",
      value: summary.bookClicks,
      help: isEnglish ? "Public-site clicks into online booking." : "Klick från företagssidan vidare till onlinebokningen.",
      icon: CalendarCheck2,
    },
    {
      label: isEnglish ? "Quote clicks" : "Offertklick",
      value: summary.quoteClicks,
      help: isEnglish ? "Clicks that opened a quote request flow." : "Klick som öppnade en offertförfrågan.",
      icon: FileText,
    },
    {
      label: isEnglish ? "Contact clicks" : "Kontaktklick",
      value: summary.contactClicks,
      help: isEnglish ? "Clicks that opened a contact request flow." : "Klick som öppnade en kontaktförfrågan.",
      icon: Send,
    },
  ];

  return (
    <div className="grid gap-6">
      <DashboardPageHeader
        eyebrow={access.workspaceName}
        title={isEnglish ? "Public site analytics" : "Analys för företagssidan"}
        description={
          isEnglish
            ? "See how visitors use your public services and which actions turn interest into bookings, quote requests or contact requests. The overview covers the last 30 days."
            : "Se hur besökare använder dina publika tjänster och vilka nästa steg som leder till bokningar, offertförfrågningar eller kontakt. Översikten visar de senaste 30 dagarna."
        }
        icon={BarChart3}
        actions={
          <Link
            href={localizedHref("/dashboard/installningar", isEnglish)}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-line bg-surface px-4 text-sm font-bold text-brand-deep transition hover:bg-surface-subtle"
          >
            {isEnglish ? "Website settings" : "Webbplatsinställningar"}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        }
      />

      <DashboardMetricGrid
        items={[
          {
            label: isEnglish ? "Visitors" : "Besökare",
            value: formatNumber(summary.visitors, isEnglish),
            helper: isEnglish ? "Unique browser sessions on the public company or service pages" : "Unika webbläsarsessioner på företagssidan eller tjänstesidorna",
            icon: Users,
            tone: "bg-[#eef5ff] text-[#1469d8]",
          },
          {
            label: isEnglish ? "Service views" : "Tjänstevisningar",
            value: formatNumber(summary.serviceViews, isEnglish),
            helper: isEnglish ? "Times a published service page was opened" : "Antal gånger en publicerad tjänstesida öppnades",
            icon: Eye,
            tone: "bg-[#eef5ff] text-[#0a2e63]",
          },
          {
            label: isEnglish ? "Visitors taking action" : "Besökare som tog nästa steg",
            value: formatNumber(summary.actionSessions, isEnglish),
            helper: isEnglish ? "Unique sessions that clicked booking, quote or contact" : "Unika sessioner som klickade på bokning, offert eller kontakt",
            icon: MousePointerClick,
            tone: "bg-[#fff7df] text-[#805d14]",
          },
          {
            label: isEnglish ? "Action rate" : "Andel som tog nästa steg",
            value: `${summary.actionRate.toFixed(1)}%`,
            helper: isEnglish ? "Visitors with at least one tracked conversion action" : "Besökare med minst en registrerad konverteringsåtgärd",
            icon: BarChart3,
            tone: "bg-surface-subtle text-brand-deep",
          },
        ]}
      />

      <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card" aria-label={isEnglish ? "Tracked conversion actions" : "Registrerade konverteringsåtgärder"}>
        <div className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">
          {actionBreakdown.map((item) => (
            <article key={item.label} className="p-5">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">{item.label}</p>
                <item.icon className="h-[18px] w-[18px] text-brand" aria-hidden="true" />
              </div>
              <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-ink">{formatNumber(item.value, isEnglish)}</p>
              <p className="mt-2 text-sm leading-5 text-ink-muted">{item.help}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <div className="border-b border-line px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-bold tracking-tight text-ink">{isEnglish ? "Top services" : "Tjänster som engagerar mest"}</h2>
              <p className="mt-1 text-sm leading-6 text-ink-muted">{isEnglish ? "Published services ranked by tracked customer actions, then page views." : "Publicerade tjänster sorterade efter registrerade kundåtgärder och därefter sidvisningar."}</p>
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">{isEnglish ? "Last 30 days" : "Senaste 30 dagarna"}</span>
          </div>
        </div>

        {services.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-surface-subtle text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                <tr>
                  <th className="px-5 py-3 sm:px-6">{isEnglish ? "Service" : "Tjänst"}</th>
                  <th className="px-4 py-3 text-right">{isEnglish ? "Views" : "Visningar"}</th>
                  <th className="px-4 py-3 text-right">{isEnglish ? "Bookings" : "Bokning"}</th>
                  <th className="px-4 py-3 text-right">{isEnglish ? "Quotes" : "Offert"}</th>
                  <th className="px-4 py-3 text-right">{isEnglish ? "Contact" : "Kontakt"}</th>
                  <th className="px-5 py-3 text-right sm:px-6">{isEnglish ? "Actions" : "Nästa steg"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {services.map((service) => (
                  <tr key={service.serviceId} className="hover:bg-surface-subtle">
                    <td className="px-5 py-4 font-bold text-ink sm:px-6">{service.serviceName}</td>
                    <td className="px-4 py-4 text-right text-ink-muted">{formatNumber(service.views, isEnglish)}</td>
                    <td className="px-4 py-4 text-right text-ink-muted">{formatNumber(service.bookClicks, isEnglish)}</td>
                    <td className="px-4 py-4 text-right text-ink-muted">{formatNumber(service.quoteClicks, isEnglish)}</td>
                    <td className="px-4 py-4 text-right text-ink-muted">{formatNumber(service.contactClicks, isEnglish)}</td>
                    <td className="px-5 py-4 text-right font-black text-brand sm:px-6">{formatNumber(service.actions, isEnglish)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-10 text-center sm:px-6">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-control bg-brand-soft text-brand"><Eye className="h-5 w-5" aria-hidden="true" /></div>
            <h3 className="mt-4 font-bold text-ink">{isEnglish ? "No service traffic yet" : "Ingen tjänstetrafik ännu"}</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink-muted">{isEnglish ? "Publish services and share your public company page. Views and customer actions will appear here automatically." : "Publicera tjänster och dela företagssidan. Visningar och kundernas nästa steg visas här automatiskt."}</p>
          </div>
        )}
      </section>

      {!hasData ? (
        <section className="rounded-card border border-dashed border-line-strong bg-surface-subtle p-5 text-sm leading-6 text-ink-muted">
          <strong className="text-ink">{isEnglish ? "Analytics is ready." : "Analysen är redo."}</strong>{" "}
          {isEnglish
            ? "Data starts appearing after visitors open the public company or service pages. No personal customer details are shown here."
            : "Data börjar visas när besökare öppnar företagssidan eller tjänstesidorna. Inga personliga kunduppgifter visas här."}
        </section>
      ) : null}
    </div>
  );
}
