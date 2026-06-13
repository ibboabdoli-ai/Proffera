import { ButtonLink } from "@/components/ui/button-link";
import { serviceTaxonomy } from "@/lib/service-taxonomy";

export default function IndustriesPage() {
  const totalServices = serviceTaxonomy.reduce((sum, category) => sum + category.services.length, 0);

  return (
    <div className="bg-[#f7f7f4]">
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Branscher</p>
        <h1 className="mt-3 max-w-4xl text-4xl font-bold tracking-tight text-[#17201a] sm:text-5xl">
          Proffera för bokningsbara tjänsteföretag i flera branscher.
        </h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#5b665f]">
          Proffera börjar med städning och lokalvård, men är byggt för att kunna växa till fler tjänstebranscher som behöver bokning, CRM, leads och AI-driven kunddialog.
        </p>
        <div className="mt-8 flex flex-wrap gap-3 text-sm font-medium text-[#314139]">
          <span className="rounded-full bg-white px-4 py-2 ring-1 ring-[#dfe5dd]">{serviceTaxonomy.length} huvudkategorier</span>
          <span className="rounded-full bg-white px-4 py-2 ring-1 ring-[#dfe5dd]">{totalServices} tjänster</span>
          <span className="rounded-full bg-white px-4 py-2 ring-1 ring-[#dfe5dd]">SaaS + bokning + CRM + AI</span>
        </div>
      </section>

      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-2">
            {serviceTaxonomy.map((category) => (
              <article key={category.slug} className="rounded-3xl border border-[#dfe5dd] bg-[#fbfbf8] p-6 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#17452f]">Kategori</p>
                    <h2 className="mt-2 text-2xl font-bold text-[#17201a]">{category.name}</h2>
                  </div>
                  <span className="w-fit rounded-full bg-[#edf4ee] px-3 py-1 text-sm font-medium text-[#17452f]">
                    {category.services.length} tjänster
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-[#5b665f]">{category.positioning}</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {category.services.map((service) => (
                    <div key={service.slug} className="rounded-2xl bg-white p-4 ring-1 ring-[#dfe5dd]">
                      <h3 className="font-semibold text-[#17201a]">{service.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-[#5b665f]">{service.description}</p>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-[#17201a] p-8 text-white lg:flex lg:items-center lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#cfe8d5]">Nästa steg</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-bold">Vill du se hur Proffera kan fungera för din bransch?</h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#d9e6dc]">
              Boka en demo så kan vi visa hur bokning, leadhantering, kundregister och AI-dialog kan anpassas för olika tjänsteföretag.
            </p>
          </div>
          <div className="mt-8 lg:mt-0">
            <ButtonLink href="/demo" variant="secondary">Boka demo</ButtonLink>
          </div>
        </div>
      </section>
    </div>
  );
}
