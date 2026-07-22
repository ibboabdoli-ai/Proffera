import type { Metadata } from "next";
import { PageShell } from "@/components/layout/page-shell";
import { serviceCategories } from "@/lib/site";

export const metadata: Metadata = {
  title: "Kategorier",
  description: "Utforska tjänstekategorier som kan organiseras i Proffera.",
};

export default function CategoriesPage() {
  return (
    <PageShell
      eyebrow="Kategorier"
      title="Tjänster som Proffera kan organisera."
      description="Kategorierna används för att strukturera tjänster, bokningar och kundflöden för tjänsteföretag."
      ctaLabel="Boka demo"
      ctaHref="/demo"
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
