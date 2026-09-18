import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

type DashboardPageHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  actions?: ReactNode;
};

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
}: DashboardPageHeaderProps) {
  return (
    <section className="rounded-card border border-line bg-surface px-5 py-5 shadow-card sm:px-6 sm:py-6 lg:px-7">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="flex max-w-4xl items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>
            <h2 className="mt-1.5 text-2xl font-bold tracking-[-0.03em] text-ink sm:text-3xl">{title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted sm:text-[15px]">{description}</p>
          </div>
        </div>
        {actions ? <div className="flex shrink-0 flex-col gap-2 sm:flex-row">{actions}</div> : null}
      </div>
    </section>
  );
}

export type DashboardMetric = {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone: string;
};

export function DashboardMetricGrid({ items }: { items: readonly DashboardMetric[] }) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card" aria-label="Sidöversikt">
      <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
        {items.map((item) => (
          <article key={item.label} className="min-w-0 p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">{item.label}</p>
              <span className={`flex h-8 w-8 items-center justify-center rounded-control ${item.tone}`}>
                <item.icon className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold tracking-[-0.04em] text-ink">{item.value}</p>
            <p className="mt-2 text-sm leading-5 text-ink-muted">{item.helper}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

type DashboardDataPanelProps = {
  title: string;
  description: string;
  count: number;
  children: ReactNode;
};

export function DashboardDataPanel({ title, description, count, children }: DashboardDataPanelProps) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-ink">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-ink-muted">{description}</p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">
          {count} {count === 1 ? "post" : "poster"}
        </span>
      </div>
      {children}
    </section>
  );
}
