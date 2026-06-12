import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { serviceCategories } from "@/lib/site";

export const metadata: Metadata = {
  title: "Kategorier",
  description: "Utforska de första tjänstekategorierna som planeras i Proffera.",
};

export default function CategoriesPage() {
  return (
    <PageShell
      eyebrow="Kategorier"
      title="Tjänster som Proffera byggs för att matcha."
      description="Kategorisidorna blir SEO- och konverteringsfokuserade i senare faser. Just nu visar sidan den planerade MVP-strukturen."
      ctaLabel="Beskriv ditt uppdrag"
      ctaHref="/fa-offert"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {serviceCategories.map((category) => (
          <article key={category} className="rounded-3xl bg-white p-5 font-semibold shadow-sm ring-1 ring-[#dfe5dd]">
            {category}
          </article>
        ))}
      </div>
    </PageShell>
  );
}
