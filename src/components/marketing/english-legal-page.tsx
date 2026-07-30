type LegalSection = {
  title: string;
  text: string;
};

type EnglishLegalPageProps = {
  title: string;
  introduction: string;
  sections: readonly LegalSection[];
  notice?: string;
};

export function EnglishLegalPage({ title, introduction, sections, notice }: EnglishLegalPageProps) {
  return (
    <div className="bg-[#f7f7f4]">
      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <p className="text-sm font-semibold uppercase tracking-wide text-[#17452f]">Legal</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#17201a] sm:text-5xl">{title}</h1>
        <p className="mt-5 text-lg leading-8 text-[#5b665f]">{introduction}</p>
        <p className="mt-4 rounded-2xl bg-white p-4 text-sm leading-6 text-[#5b665f] ring-1 ring-[#dfe5dd]">
          Last updated: 22 July 2026. {notice ?? "This English version is provided for convenience; the Swedish version prevails if there is a difference."}
        </p>
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
        <div className="space-y-4">
          {sections.map((section) => (
            <article key={section.title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-[#dfe5dd]">
              <h2 className="text-xl font-semibold text-[#17201a]">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#5b665f]">{section.text}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
