import Link from "next/link";

type LegalSection = {
  title: string;
  text: string;
};

type EnglishLegalPageProps = {
  title: string;
  introduction: string;
  sections: readonly LegalSection[];
  notice?: string;
  swedishHref: string;
};

export function EnglishLegalPage({ title, introduction, sections, notice, swedishHref }: EnglishLegalPageProps) {
  return (
    <main className="min-h-screen bg-[#f6f9fd] text-[#11213b]" lang="en">
      <section className="border-b border-[#dce4ee] bg-white">
        <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="flex items-start justify-between gap-5">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.15em] text-[#1469d8]">Legal</p>
              <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.04em] text-[#0a2e63] sm:text-5xl">{title}</h1>
            </div>
            <Link href={swedishHref} className="text-sm font-bold text-[#1469d8] underline underline-offset-4">Svenska</Link>
          </div>
          <p className="mt-5 max-w-3xl text-base leading-8 text-[#617085]">{introduction}</p>
          <p className="mt-5 border-l-2 border-[#1469d8] pl-4 text-sm leading-6 text-[#617085]">
            Last updated: 22 July 2026. {notice ?? "This English version is provided for convenience; the Swedish version prevails if there is a difference."}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="divide-y divide-[#dce4ee] border-y border-[#dce4ee] bg-white px-5 sm:px-7">
          {sections.map((section) => (
            <article key={section.title} className="py-6">
              <h2 className="text-xl font-bold text-[#0a2e63]">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-[#617085]">{section.text}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
