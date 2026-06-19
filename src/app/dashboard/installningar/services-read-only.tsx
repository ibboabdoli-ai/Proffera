import type { DashboardWorkspaceService } from "@/lib/workspace-services-db";

import { createWorkspaceServiceAction, updateWorkspaceServiceAction } from "./service-actions";

const fieldClass =
  "rounded-2xl border border-[#dfe5dd] px-4 py-3 text-sm font-normal text-[#17201a] outline-none transition focus:border-[#17452f] focus:ring-2 focus:ring-[#17452f]/20";

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

type ServiceFieldsProps = {
  service?: DashboardWorkspaceService;
};

function ServiceFields({ service }: ServiceFieldsProps) {
  return (
    <div className="grid gap-3">
      <label className="grid gap-2 text-sm font-semibold text-[#344139]">
        Intern åtkomstkod
        <input name="access_code" type="password" required autoComplete="off" className={fieldClass} placeholder="Ange intern kod" />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-[#344139]">
        Namn
        <input name="name" type="text" required maxLength={140} className={fieldClass} defaultValue={service?.name ?? ""} />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-[#344139]">
        Beskrivning
        <textarea name="description" maxLength={500} className={fieldClass} defaultValue={service?.description ?? ""} />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-[#344139]">
          Kategori
          <input name="category" type="text" maxLength={120} className={fieldClass} defaultValue={service?.category ?? ""} />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-[#344139]">
          Prisvisning
          <input name="price_label" type="text" maxLength={120} className={fieldClass} defaultValue={service?.priceLabel ?? ""} />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-2 text-sm font-semibold text-[#344139]">
          Baspris SEK
          <input name="base_price_sek" type="number" min={0} className={fieldClass} defaultValue={service?.basePriceSek ?? ""} />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-[#344139]">
          Längd min
          <input name="duration_minutes" type="number" min={1} max={1440} className={fieldClass} defaultValue={service?.durationMinutes ?? ""} />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-[#344139]">
          Sortering
          <input name="sort_order" type="number" min={0} max={9999} required className={fieldClass} defaultValue={service?.sortOrder ?? 100} />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-[#344139]">
        Område
        <input name="service_area" type="text" maxLength={240} className={fieldClass} defaultValue={service?.serviceArea ?? ""} />
      </label>

      <label className="flex items-center gap-3 text-sm font-semibold text-[#344139]">
        <input name="is_active" type="checkbox" defaultChecked={service?.isActive ?? true} />
        Aktiv tjänst
      </label>
    </div>
  );
}

export function ServicesReadOnly({ services }: ServicesReadOnlyProps) {
  const activeServices = services.filter((service) => service.isActive).length;

  return (
    <section id="tjanster" className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Tjänster</p>
          <h3 className="mt-2 text-xl font-bold text-[#17201a]">Hantera tjänstekatalog</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5b665f]">
            Lägg till, justera och sortera de tjänster som kunder kan fråga om, boka eller få offert på.
          </p>
        </div>
        <span className="w-fit rounded-full bg-[#e7f1eb] px-3 py-1 text-xs font-semibold text-[#17452f]">
          {services.length > 0 ? `${activeServices} aktiva tjänster` : "Redo att fyllas i"}
        </span>
      </div>

      <details className="mt-6 rounded-2xl border border-[#dfe5dd] bg-[#fdfdfb] p-5">
        <summary className="cursor-pointer text-sm font-bold text-[#17201a]">Skapa ny tjänst</summary>
        <form action={createWorkspaceServiceAction} className="mt-5 space-y-4">
          <ServiceFields />
          <button type="submit" className="inline-flex w-full items-center justify-center rounded-full bg-[#17452f] px-6 py-3 text-sm font-semibold !text-white transition hover:bg-[#123824] hover:!text-white focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2">
            Skapa tjänst
          </button>
        </form>
      </details>

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

              <details className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-[#dfe5dd]">
                <summary className="cursor-pointer text-sm font-bold text-[#17201a]">Redigera tjänst</summary>
                <form action={updateWorkspaceServiceAction} className="mt-5 space-y-4">
                  <input type="hidden" name="service_id" value={service.id} />
                  <ServiceFields service={service} />
                  <button type="submit" className="inline-flex w-full items-center justify-center rounded-full bg-[#17452f] px-6 py-3 text-sm font-semibold !text-white transition hover:bg-[#123824] hover:!text-white focus:outline-none focus:ring-2 focus:ring-[#17452f] focus:ring-offset-2">
                    Spara tjänst
                  </button>
                </form>
              </details>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-2xl bg-[#f7f7f4] p-5 text-sm leading-6 text-[#5b665f]">
          Inga tjänster visas ännu. Skapa första tjänsten för att göra kundflöden, offertunderlag och kommande AI-svar tydligare.
        </div>
      )}
    </section>
  );
}
