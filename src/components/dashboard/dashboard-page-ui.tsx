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
    <section className="relative overflow-hidden rounded-[24px] border border-[#dfe5dd] bg-white px-5 py-6 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.05)] sm:px-7 sm:py-7 lg:px-8">
      <div className="absolute right-0 top-0 h-32 w-32 translate-x-1/3 -translate-y-1/3 rounded-full bg-[#eaf2ec] blur-2xl" aria-hidden="true" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-3xl items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#173e2b] text-white shadow-lg shadow-[#173e2b]/15">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#17452f]">{eyebrow}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-[#17201a] sm:text-3xl">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-[#667168] sm:text-[15px]">{description}</p>
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
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Sidöversikt">
      {items.map((item) => (
        <article
          key={item.label}
          className="rounded-2xl border border-[#e0e5dd] bg-white p-5 shadow-[0_1px_2px_rgba(20,43,32,0.03),0_10px_26px_rgba(20,43,32,0.035)] transition hover:-translate-y-0.5 hover:border-[#cfd8cd] hover:shadow-[0_14px_30px_rgba(20,43,32,0.07)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#778179]">{item.label}</p>
              <p className="mt-3 text-3xl font-bold tracking-tight text-[#173e2b]">{item.value}</p>
            </div>
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.tone}`}>
              <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 text-sm leading-5 text-[#6a756d]">{item.helper}</p>
        </article>
      ))}
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
    <section className="overflow-hidden rounded-[24px] border border-[#e0e5dd] bg-white shadow-[0_1px_2px_rgba(20,43,32,0.03),0_14px_36px_rgba(20,43,32,0.045)]">
      <div className="flex flex-col gap-3 border-b border-[#e5e9e2] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-[#17201a]">{title}</h3>
          <p className="mt-1 text-sm leading-6 text-[#667168]">{description}</p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full bg-[#eaf2ec] px-3 py-1.5 text-xs font-bold text-[#17452f]">
          {count} {count === 1 ? "post" : "poster"}
        </span>
      </div>
      {children}
    </section>
  );
}
