import type { DashboardWorkspaceService } from "@/lib/workspace-services-db";

function visibleValue(value: string) {
  return value.trim().length > 0 ? value : "Ej angivet";
}

function formatDuration(value: number | null) {
  return value ? `${value} min` : "Ej angivet";
}

function formatPrice(value: number | null) {
  return value === null ? "Ej angivet" : `${value} kr`;
}

type ServicesReadOnlyProps = {
  services: DashboardWorkspaceService[];
};

export function ServicesReadOnly({ services }: ServicesReadOnlyProps) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-xl font-bold text-[#17201a]">Tjänster</h3>
          <p className="mt-2 text-sm leading-6 text-[#5b665f]">Read-only vy för tjänster i workspace default.</p>
        </div>
        <span className="w-fit rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">Phase 18.16A</span>
      </div>

      {services.length > 0 ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          {services.map((service) => (
            <article key={service.id} className="rounded-2xl border border-[#dfe5dd] bg-[#fdfdfb] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-[#17201a]">{service.name}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#5b665f]">{visibleValue(service.category)}</p>
                </div>
                <span className="rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">{service.isActive ? "Aktiv" : "Inaktiv"}</span>
              </div>

              <p className="mt-4 text-sm leading-6 text-[#5b665f]">{visibleValue(service.description)}</p>
              <div className="mt-5 grid gap-2 text-sm text-[#5b665f]">
                <p><strong className="text-[#17201a]">Pris:</strong> {visibleValue(service.priceLabel)}</p>
                <p><strong className="text-[#17201a]">Baspris:</strong> {formatPrice(service.basePriceSek)}</p>
                <p><strong className="text-[#17201a]">Längd:</strong> {formatDuration(service.durationMinutes)}</p>
                <p><strong className="text-[#17201a]">Område:</strong> {visibleValue(service.serviceArea)}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl bg-[#f7f7f4] p-5 text-sm leading-6 text-[#5b665f]">Inga tjänster visas ännu.</div>
      )}
    </section>
  );
}
